import { InstanceStatus } from '@/modules/thinkzap/domain/entities/instance'
import {
  ConnectorConnectionStatus,
  ConnectorResourceRef,
  ConnectorStatusRef,
  ProvisionConnectorInput,
  ProvisionedConnectorResource,
  SubscribeOutcome,
  WhatsAppConnectorProvider,
} from '@/modules/thinkzap/domain/ports/whatsapp-connector-provider.port'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import {
  HUBMESSAGE_CHANNEL_WEBHOOK_EVENTS,
  ListBusinessesResponse,
} from '@/modules/thinkzap/infra/clients/types/hubmessage.types'
import { apiLogger } from '@/shared/infra/logger'
import {
  logThinkzapError,
  thinkzapError,
} from '@/modules/thinkzap/errors/catalog'

export type HubMessageProviderConfig = {
  webhookUrl: string
}

/**
 * Adapter HubMessage (WhatsApp Oficial) do contrato `WhatsAppConnectorProvider`.
 * Provisiona canal `META_WHATSAPP` + webhook vinculado; assina/cancela/desconecta canal.
 */
export class HubMessageConnectorProvider implements WhatsAppConnectorProvider {
  /**
   * Memoização escopada à vida da instância do adapter (criada por request na
   * listagem de conectores): evita repetir `GET /whatsapp/businesses` uma vez por
   * conector HubMessage do mesmo app.
   */
  private businessesCache?: Promise<ListBusinessesResponse>

  constructor(
    private readonly client: HubMessageClient,
    private readonly config: HubMessageProviderConfig,
  ) {}

  async provisionConnector(
    input: ProvisionConnectorInput,
  ): Promise<ProvisionedConnectorResource> {
    // Retomada idempotente: canal já existe, só falta o webhook.
    const channelId =
      input.existingRemoteId ??
      (
        await this.client.createChannel({
          name: input.name,
          type: 'META_WHATSAPP',
        })
      ).id

    // Webhook não é fatal: o canal já existe remotamente e falhar aqui abortaria
    // a persistência do conector, deixando o canal órfão e recriando outro a cada
    // retry. Persistimos com `webhookId: null`; o vínculo é criado depois, quando
    // o canal conectar (ver `ensureWebhook`).
    let webhookId: string | null = null
    try {
      const webhook = await this.client.createWebhook(channelId, {
        url: this.config.webhookUrl,
        events: HUBMESSAGE_CHANNEL_WEBHOOK_EVENTS,
      })
      webhookId = webhook.id
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.hubmessage.request_failed',
        { app: 'thinkzap', channelId, err: error },
        {
          level: 'warn',
          msg: 'HubMessage: canal criado, mas webhook falhou — conector segue sem webhook',
        },
      )
    }

    return {
      // Id remoto principal persistido em Instance.instanceId = channelId.
      instanceId: channelId,
      status: InstanceStatus.CONNECTING,
      channelId,
      webhookId,
    }
  }

  subscribe(ref: ConnectorResourceRef): Promise<SubscribeOutcome> {
    return this.client.subscribeChannel(this.requireChannelId(ref))
  }

  async unsubscribe(ref: ConnectorResourceRef, reason?: string): Promise<void> {
    await this.client.cancelChannel(
      this.requireChannelId(ref),
      reason ?? 'Cancelamento de assinatura',
    )
  }

  async disconnect(ref: ConnectorResourceRef): Promise<void> {
    await this.client.disconnectChannel(this.requireChannelId(ref))
  }

  async getConnectionStatus(
    ref: ConnectorStatusRef,
  ): Promise<ConnectorConnectionStatus> {
    // Sem wabaId não há como cruzar com o agregado por WABA.
    if (!ref.wabaId) {
      return { connected: false, available: true }
    }
    try {
      const { items } = await this.listBusinessesMemoized()
      const business = items.find(b => b.businessId === ref.wabaId)
      // WABA não encontrada → canal não conectado (nenhum canal ativo na WABA).
      const connected = business ? business.connectedCount > 0 : false
      return { connected, available: true }
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.hubmessage.request_failed',
        { app: 'thinkzap', wabaId: ref.wabaId, err: error },
        {
          level: 'warn',
          msg: 'HubMessage: falha ao consultar status do canal — status ao vivo indisponível',
        },
      )
      return { connected: false, available: false }
    }
  }

  private listBusinessesMemoized(): Promise<ListBusinessesResponse> {
    if (!this.businessesCache) {
      this.businessesCache = this.client.listBusinesses().catch(error => {
        // Não cacheia a falha: permite nova tentativa em chamadas posteriores.
        this.businessesCache = undefined
        throw error
      })
    }
    return this.businessesCache
  }

  private requireChannelId(ref: ConnectorResourceRef): string {
    const channelId = ref.channelId ?? ref.instanceId
    if (!channelId) {
      throw thinkzapError('thinkzap.provisioning.credential_missing')
    }
    return channelId
  }
}
