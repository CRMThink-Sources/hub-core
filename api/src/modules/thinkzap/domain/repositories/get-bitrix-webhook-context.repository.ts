import { Credential } from '@/shared/domain/entities/credential'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'

export interface BitrixWebhookContext {
  id: string
  name: string
  memberId: string
  app: {
    id: string
    domainId: string
    appCodeId: string
    status: string
    credential: Credential
  }
  /**
   * Provider do conector da instância — decide para onde a resposta do canal
   * aberto é despachada. Instância sem conector associado resolve `ZAPI`.
   */
  connector: {
    provider: ConnectorProvider
  }
  instance: {
    instanceId: string
    zApiToken: string | null
    channelId: string | null
    id: string
    createdAt: Date
    updatedAt: Date
    vinculatedChannel: string | null
    domainId: string
    status: string
    settings: ConnectorSettings
  }
}

export interface GetBitrixWebhookContextRepository {
  getContext(params: {
    domainName: string
    appCode: string
    line: string
  }): Promise<BitrixWebhookContext | null>
}
