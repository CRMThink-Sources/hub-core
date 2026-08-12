import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import type { RawSubscriptionItemCredentials } from '@/modules/thinkzap/domain/ports/raw-subscription-item-reader.port'

/**
 * O que fazer com um item da SPA 1146 que acabou de nascer, decidido pelo provider
 * **declarado** cruzado com a credencial que o item carrega.
 *
 * A matriz é deliberadamente a **mesma** que `resolveMetadata` decide na leitura do
 * item, com um caso a mais: "provider declarado sem credencial", que lá é incoerência
 * e aqui é o trabalho a fazer. Escrever as duas a partir da mesma matriz é o que
 * impede que elas divirjam — o dia em que a leitura passar a aceitar um par novo, o
 * teste desta função aponta o buraco.
 *
 * ```
 * provider     credencial      ação
 * ───────────  ──────────────  ──────────────────────────────────
 * ZAPI         par completo    already-provisioned
 * ZAPI         par incompleto  refuse: zapi-pair-incomplete
 * ZAPI         vazia           provision ZAPI
 * ZAPI         HubMessage      refuse: credential-provider-mismatch
 * HUBMESSAGE   canal           already-provisioned
 * HUBMESSAGE   WABA sem canal  refuse: orphan-waba
 * HUBMESSAGE   vazia           provision HUBMESSAGE
 * HUBMESSAGE   Z-API           refuse: credential-provider-mismatch
 * NONE         vazia           no-connector
 * NONE         qualquer        refuse: none-with-credential
 * vazio        —               refuse: provider-not-declared
 * outro        —               refuse: provider-unknown
 * ```
 *
 * Função pura, sem log e sem efeito: quem loga é o caso de uso, que tem o id do item
 * e o `traceKey` do job. Aqui só a decisão, para que a matriz seja testável sem
 * montar um provider falso.
 */

/** Por que um item não é provisionável. Cada valor tem uma mensagem própria. */
export type ProvisioningRefusal =
  /** `ufCrm93Provider` vazio: item não declara o que é. */
  | 'provider-not-declared'
  /** Valor fora de `ZAPI` / `HUBMESSAGE` / `NONE`. */
  | 'provider-unknown'
  /** Metade do par da Z-API: id sem token, ou token sem id. */
  | 'zapi-pair-incomplete'
  /** WABA preenchida e canal vazio: credencial que não identifica recurso. */
  | 'orphan-waba'
  /** Item declara um provider e carrega credencial do outro. */
  | 'credential-provider-mismatch'
  /** `NONE` com credencial: item de cobrança não tem conector. */
  | 'none-with-credential'

export type ProvisioningAction =
  /** Provisionar o recurso neste provider e gravar a credencial no item. */
  | { kind: 'provision'; provider: ConnectorProvider }
  /**
   * Recurso já existe — item criado pela nossa própria API, ou credencial colada à
   * mão pelo operador. Segue para a reconciliação de cobrança **sem** tocar o
   * provider: provisionar outro descartaria o recurso em uso.
   */
  | { kind: 'already-provisioned'; provider: ConnectorProvider }
  /**
   * Item de cobrança sem conector. Nada a provisionar, e isso não é erro.
   *
   * Também não há cobrança a reconciliar: `countActiveLinesByProvider` ignora item
   * `NONE`, então a contagem de linhas do contrato não mudou com este item nascendo.
   * Sincronizar seria uma ida ao gateway para reenviar exatamente a quantidade que
   * já está lá.
   */
  | { kind: 'no-connector' }
  | { kind: 'refuse'; reason: ProvisioningRefusal; detail: string }

const REFUSAL_DETAIL: Record<ProvisioningRefusal, string> = {
  'provider-not-declared':
    'Item sem "ufCrm93Provider" preenchido: não há como saber que conector criar. ' +
    'Item de cobrança sem conector é "NONE" escrito, não campo vazio.',
  'provider-unknown':
    'Provider de item desconhecido. Os valores aceitos são "ZAPI", "HUBMESSAGE" e "NONE".',
  'zapi-pair-incomplete':
    'Par de credenciais da Z-API incompleto: id da instância e token têm que vir ' +
    'juntos. Provisionar aqui sobrescreveria o campo que foi preenchido de propósito.',
  'orphan-waba':
    'Item com WABA e sem id do canal da HubMessage: a WABA não identifica recurso ' +
    'nenhum sem o canal.',
  'credential-provider-mismatch':
    'Item declara um provider e carrega credencial do outro: um item de assinatura é ' +
    'um conector só.',
  'none-with-credential':
    'Item declara provider "NONE" mas carrega credencial de conector: item de ' +
    'cobrança sem conector não tem credencial.',
}

const refuse = (reason: ProvisioningRefusal): ProvisioningAction => ({
  kind: 'refuse',
  reason,
  detail: REFUSAL_DETAIL[reason],
})

export function resolveProvisioningAction(input: {
  /** `ufCrm93Provider` já normalizado pelo leitor cru. */
  provider: string
  credentials: RawSubscriptionItemCredentials
}): ProvisioningAction {
  const { credentials: c } = input

  const zApiFilled = [c.zApiInstanceId, c.zApiInstanceToken].filter(
    Boolean,
  ).length
  const hasChannel = Boolean(c.hubmessageChannelId)
  const hasWaba = Boolean(c.wabaId)
  const hasHubMessage = hasChannel || hasWaba

  switch (input.provider) {
    case '':
      return refuse('provider-not-declared')

    case 'ZAPI': {
      if (hasHubMessage) return refuse('credential-provider-mismatch')
      if (zApiFilled === 1) return refuse('zapi-pair-incomplete')
      if (zApiFilled === 2) {
        return { kind: 'already-provisioned', provider: ConnectorProvider.ZAPI }
      }

      return { kind: 'provision', provider: ConnectorProvider.ZAPI }
    }

    case 'HUBMESSAGE': {
      if (zApiFilled > 0) return refuse('credential-provider-mismatch')
      /**
       * WABA órfã é recusa, e não provisionamento: o canal que ela pertencia existe
       * em algum lugar, e criar outro deixaria o primeiro órfão — pago por nós.
       */
      if (hasWaba && !hasChannel) return refuse('orphan-waba')
      if (hasChannel) {
        return {
          kind: 'already-provisioned',
          provider: ConnectorProvider.HUBMESSAGE,
        }
      }

      return { kind: 'provision', provider: ConnectorProvider.HUBMESSAGE }
    }

    case 'NONE':
      return zApiFilled > 0 || hasHubMessage
        ? refuse('none-with-credential')
        : { kind: 'no-connector' }

    default:
      return refuse('provider-unknown')
  }
}
