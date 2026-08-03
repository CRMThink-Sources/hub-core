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
    /**
     * Espelho da coluna, mantido só porque a row ainda a tem. **Não é fonte de
     * verdade e não deve ser lido para decidir comportamento** — os toggles vivem
     * em `ufCrm93Settings` no item de assinatura, e quem precisa deles resolve por
     * `resolveSettingsByInstanceId`. Ler daqui devolve o valor congelado de antes
     * da migração.
     */
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
