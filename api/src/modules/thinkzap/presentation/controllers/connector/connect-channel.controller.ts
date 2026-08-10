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
import { findLineItemByChannelId } from '@/modules/thinkzap/application/helpers/resolve-settings-by-instance-id'
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { mapLineBlockedError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

/**
 * Conclui a conexão de um canal HubMessage (WhatsApp Oficial). O SDK roda no
 * iframe Bitrix, onde o cliente autentica a própria conta Meta e obtém
 * `wabaId/phoneId/code`. `coexistence` é fixo `false` nesta entrega.
 *
 * É o par oficial do QR code, e recusa pela mesma razão: conectar é abrir sessão,
 * e linha de trial vencido que reconecta volta a funcionar por fora do bloqueio.
 */
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

  /**
   * Grava a WABA no item de assinatura da linha.
   *
   * **É aqui que a WABA passa a existir para o produto.** O provisionamento cria só o
   * canal; a WABA vem do embedded signup, nesta requisição. Antes disso ela era
   * gravada apenas na `Instance`, e o item — que é a linha do ponto de vista do
   * cliente, e a fonte que templates leem — nunca a recebia.
   *
   * Só o `metadata`: `settings` e `vinculatedChannel` são configuração do cliente e
   * não têm nada a ver com conectar um número.
   *
   * **Não é fatal.** O canal já está conectado no provider neste ponto, e falhar aqui
   * transformaria uma conexão bem-sucedida em erro na cara do cliente. O que se perde
   * é a WABA no item — que os templates recusam nomeando —, e a recuperação é
   * reconectar ou gravar à mão no CRM.
   */
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
      apiLogger.error(
        { app: 'thinkzap', channelId, wabaId, err: error },
        'Canal conectado e a WABA não foi gravada no item da linha — templates vão recusar até ela existir; gravar à mão no CRM',
      )
    }
  }

  /**
   * Recusa a conexão quando o canal pertence a uma linha bloqueada.
   *
   * A resolução é pelo `channelId` porque esta rota é keyed por `connectorId`, não
   * pelo item — ela nasceu antes de a linha ser o item da SPA.
   *
   * **Canal sem item correspondente segue conectando**, com warning: `Connector`
   * ainda tem rows anteriores à SPA, e recusar todas elas transformaria um bloqueio
   * de trial em quebra do caminho legado. A linha sem item já é barrada em todo
   * caminho de mensagem, que resolve `inactive` na ausência de assinatura pai.
   */
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

    /**
     * A instalação vem do JWT, nunca do corpo — do mesmo jeito que nas rotas de
     * linha. Ausente é erro de rota (o `authMiddleware` já roda antes), não algo a
     * degradar para "não verificado".
     */
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

    /** Antes de tocar a HubMessage: recusada não gasta autenticação Meta. */
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

    /**
     * Depois de a conexão estar gravada: a `Instance` é o que o caminho legado lê, e o
     * item é o que a linha do cliente é hoje. Os dois precisam da WABA.
     */
    await this.saveWabaOnLine(channelId, wabaId, scope.data)

    return this.ok({ message: 'Channel connected successfully' })
  }
}
