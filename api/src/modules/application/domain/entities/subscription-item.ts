import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'

export type SubscriptionItemMetadata =
  | { provider: 'ZAPI'; zApiInstanceId: string; zApiInstanceToken: string }
  | {
      provider: 'HUBMESSAGE'
      hubmessageChannelId: string
      /**
       * WABA do canal. **Ausente até o cliente conectar o número na Meta.**
       *
       * O canal é criado no provisionamento; a WABA só existe depois do embedded
       * signup, e chega em `POST /connector/connect-channel`. Exigi-la aqui tornava a
       * linha do WhatsApp Oficial **impossível de criar** — o provisionamento nunca
       * devolve WABA, então toda tentativa (trial ou linha adicional) morria antes de
       * gravar o item.
       *
       * `hubmessageChannelId` continua obrigatório: sem canal não há recurso, e é ele
       * que identifica a linha no provider. Quem precisa da WABA — templates — recusa
       * nomeando que o canal ainda não foi conectado.
       */
      wabaId?: string
    }
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
  /**
   * Quando e por quem a linha foi excluída pela rota do cliente. `null` = nunca
   * excluída; **opcional**, e não `Date | null` puro, pelo mesmo motivo de
   * `gatewayId` — dezenas de fixtures de teste já montam `SubscriptionItem` sem
   * conhecer este campo, e forçar presença obrigaria todas a mudar por uma
   * coluna que não testam.
   *
   * Persistidos em `ufCrm93DeletedAt`/`ufCrm93DeletedBy`. Excluir não apaga mais o
   * item (`DeleteLine`): edita para `status: 'cancelled'` e preenche estes dois,
   * mantendo o registro no CRM em vez de descartá-lo.
   */
  deletedAt?: Date | null
  deletedBy?: string | null
}
