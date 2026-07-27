import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import z from 'zod'

import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { UpdateInstanceRepository } from '@/modules/thinkzap/domain/repositories/update-instance.repository'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'

/**
 * Conclui a conexão de um canal HubMessage (WhatsApp Oficial). O SDK roda no
 * iframe Bitrix, onde o cliente autentica a própria conta Meta e obtém
 * `wabaId/phoneId/code`. `coexistence` é fixo `false` nesta entrega.
 */
export class ConnectChannelController extends Controller {
  constructor(
    private readonly hubMessageClient: HubMessageClient,
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly instanceRepository: GetInstanceRepository &
      UpdateInstanceRepository,
    private readonly webhookUrl: string,
  ) {
    super()
  }

  /**
   * Cria o webhook do canal quando o provisionamento não conseguiu criá-lo.
   * Não é fatal: o canal já está conectado e o vínculo pode ser refeito depois.
   */
  private async createWebhookIfMissing(
    channelId: string,
    existingWebhookId: string | null | undefined,
  ): Promise<string | null> {
    if (existingWebhookId) return null

    try {
      const webhook = await this.hubMessageClient.createWebhook(channelId, {
        url: this.webhookUrl,
        events: ['MESSAGE_RECEIVED'],
      })
      return webhook.id
    } catch (error) {
      console.warn(
        `[thinkzap] HubMessage: falha ao criar webhook do canal ${channelId} após conexão`,
        error,
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

    return this.ok({ message: 'Channel connected successfully' })
  }
}
