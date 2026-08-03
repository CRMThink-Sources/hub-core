import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'

export type SubscriptionItemMetadata =
  | { provider: 'ZAPI'; zApiInstanceId: string; zApiInstanceToken: string }
  | { provider: 'HUBMESSAGE'; hubmessageChannelId: string; wabaId: string }
  | { provider: 'NONE' }

export interface SubscriptionItem {
  id: string
  name: string

  subscription: string
  status: 'active' | 'cancelled'
  metadata: SubscriptionItemMetadata
  /**
   * Ajustes do conector, fonte de verdade na SPA (`ufCrm93Settings`).
   *
   * **Sempre resolvido, nunca `undefined`:** campo ausente na SPA devolve
   * `DEFAULT_CONNECTOR_SETTINGS`. Não existe distinção entre "sem settings" e
   * "settings default" — ela não teria significado, e obrigaria todo consumidor
   * a repetir um `?? {}`.
   *
   * Fora de `metadata` de propósito: `metadata` é união discriminada por provider
   * e é gravada como bloco (o mapper zera os campos do outro provider), então
   * settings ali significaria remandar a credencial para salvar um toggle, e
   * perder a configuração ao trocar de provider. Os quatro toggles também não são
   * provider-specific.
   */
  settings: ConnectorSettings
  /**
   * Id do canal aberto do Bitrix ao qual a linha está vinculada. `null` = sem
   * vínculo, e sem ele a mensagem não chega ao CRM do cliente.
   *
   * Persistido em `ufCrm93Conector` — campo que existia na SPA sem nenhum
   * consumidor no código (legado do modelo anterior) e foi reaproveitado. O título
   * dele no Bitrix diz "Conector", não canal aberto: se o CRM ainda mostrar isso,
   * é o título que está errado, não este campo.
   */
  vinculatedChannel: string | null
  gatewayId?: string
}
