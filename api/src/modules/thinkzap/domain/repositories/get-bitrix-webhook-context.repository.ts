import { Credential } from '@/shared/domain/entities/credential'
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
  instance: {
    instanceId: string
    zApiToken: string | null
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
