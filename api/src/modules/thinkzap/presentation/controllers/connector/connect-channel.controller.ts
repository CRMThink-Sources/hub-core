import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import z from 'zod'

import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { UpdateInstanceRepository } from '@/modules/thinkzap/domain/repositories/update-instance.repository'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { HUBMESSAGE_CHANNEL_WEBHOOK_EVENTS } from '@/modules/thinkzap/infra/clients/types/hubmessage.types'
import { findLineItemByChannelId } from '@/modules/thinkzap/application/helpers/resolve-settings-by-instance-id'
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { mapLineBlockedError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

// Recusa linha bloqueada como o QR code: reconectar trial vencido furaria o bloqueio.
export class ConnectChannelController extends Controller {
  constructor(
    private readonly hubMessageClient: HubMessageClient,
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly instanceRepository: GetInstanceRepository &
      UpdateInstanceRepository,
    private readonly webhookUrl: string,
    private readonly getAplicationContext: GetAplicationContext,
    private readonly items: SubscriptionItemRepository,
  ) {
    super()
  }

  // Único ponto onde a WABA chega ao item (fonte dos templates). Não fatal: o canal já está conectado.
  private async saveWabaOnLine(
    channelId: string,
    wabaId: string,
    scope: { domainId: string; appCode: string },
  ): Promise<void> {
    try {
      const line = await findLineItemByChannelId(
        { channelId, domainId: scope.domainId, appCode: scope.appCode },
        this.getAplicationContext,
      )

      if (!line) return

      const { metadata } = line.item
      if (metadata.provider !== 'HUBMESSAGE') return
      if (metadata.wabaId === wabaId) return

      await this.items.updateSubscriptionItem(line.item.id, {
        metadata: { ...metadata, wabaId },
      })
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.line.waba_persist_failed',
        { app: 'thinkzap', channelId, wabaId, err: error },
        { level: 'error' },
      )
    }
  }

  // Canal sem item segue conectando: há Connectors legados anteriores à SPA, barrados no caminho de mensagem.
  private async assertChannelEnabled(
    channelId: string,
    domainId: string,
    appCode: string,
  ): Promise<void> {
    const line = await findLineItemByChannelId(
      { channelId, domainId, appCode },
      this.getAplicationContext,
    )

    if (!line) {
      apiLogger.warn(
        { app: 'thinkzap', channelId },
        'Conexão de canal HubMessage sem item de assinatura correspondente — habilitação não verificada',
      )
      return
    }

    if (line.entitlement !== 'active') {
      throw new LineBlockedError(line.item.id, line.entitlement)
    }
  }

  // Não fatal: o canal já está conectado e o vínculo pode ser refeito depois.
  private async createWebhookIfMissing(
    channelId: string,
    existingWebhookId: string | null | undefined,
  ): Promise<string | null> {
    if (existingWebhookId) return null

    try {
      const webhook = await this.hubMessageClient.createWebhook(channelId, {
        url: this.webhookUrl,
        events: HUBMESSAGE_CHANNEL_WEBHOOK_EVENTS,
      })
      return webhook.id
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.hubmessage.request_failed',
        { app: 'thinkzap', channelId, err: error },
        {
          level: 'warn',
          msg: 'HubMessage: falha ao criar webhook do canal após conexão — conector segue sem webhook',
        },
      )
      return null
    }
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const params = z
      .object({
        connectorId: z.string().min(1),
        wabaId: z.string().min(1),
        phoneId: z.string().min(1),
        code: z.string().min(1),
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    // Instalação vem do JWT, nunca do corpo.
    const scope = z
      .object({ domainId: z.string().min(1), appCode: z.string().min(1) })
      .safeParse({ domainId: req.domainId, appCode: req.appId })

    if (!scope.success) {
      return this.badRequest(
        new Error('Invalid request: ' + scope.error.message),
      )
    }

    const { connectorId, wabaId, phoneId, code } = params.data

    const connector = await this.getConnectorRepository.get(connectorId)
    if (!connector) {
      return this.notFound(new Error('Connector not found'))
    }

    if (
      (connector.provider ?? ConnectorProvider.ZAPI) !==
      ConnectorProvider.HUBMESSAGE
    ) {
      return this.badRequest(new Error('Conector não é do provider HubMessage'))
    }

    const instance = await this.instanceRepository.getInstance(
      connector.instanceId,
    )
    if (!instance) {
      return this.notFound(new Error('Instance not found'))
    }

    const channelId = instance.channelId ?? instance.instanceId
    if (!channelId) {
      return this.badRequest(new Error('Conector HubMessage sem channelId'))
    }

    // Antes da HubMessage: recusada não gasta autenticação Meta.
    try {
      await this.assertChannelEnabled(
        channelId,
        scope.data.domainId,
        scope.data.appCode,
      )
    } catch (error) {
      if (error instanceof LineBlockedError) {
        return mapLineBlockedError(error)
      }
      throw error
    }

    await this.hubMessageClient.connectChannel(channelId, {
      wabaId,
      phoneId,
      code,
      coexistence: false,
    })

    const webhookId = await this.createWebhookIfMissing(
      channelId,
      instance.webhookId,
    )

    await this.instanceRepository.markAsConnected(instance.id, {
      wabaId,
      phoneId,
      webhookId,
    })

    // Instance (legado) e item precisam da WABA.
    await this.saveWabaOnLine(channelId, wabaId, scope.data)

    return this.ok({ message: 'Channel connected successfully' })
  }
}
