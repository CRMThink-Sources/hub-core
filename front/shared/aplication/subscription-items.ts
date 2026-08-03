import type {
  SubscriptionItemMetadataView,
  SubscriptionItemView,
  SubscriptionView,
} from './aplication-context'

/**
 * Lista de conexões derivada dos itens das assinaturas de
 * `GET /api/application/me`.
 *
 * A lista **não** é mais montada a partir de conector/instância: a linha
 * contratada é o item da assinatura, e é ele que existe do ponto de vista do
 * cliente. Consequência aceita: status de conexão ao vivo, canal vinculado e
 * telefone não aparecem aqui — nada disso está no item. Essa informação passa a
 * viver na tela de configuração, que será replanejada.
 */

/** Provider da linha, como a UI rotula. */
export type LineProvider = 'ZAPI' | 'HUBMESSAGE' | 'NONE'

export type SubscriptionLine = {
  /** Id do item na SPA de itens de assinatura. */
  id: string
  name: string
  status: SubscriptionItemView['status']
  provider: LineProvider
  /** Id da assinatura que cobra esta linha. */
  subscriptionId: string
  /** Nome do plano da assinatura — o que o cliente contratou. */
  planName: string
  /**
   * Identificador da linha no provider, quando existe. Não é credencial: o
   * mapper do api já redige o token da Z-API.
   */
  providerRef: string | null
}

const providerRef = (metadata: SubscriptionItemMetadataView): string | null => {
  switch (metadata.provider) {
    case 'ZAPI':
      return metadata.zApiInstanceId
    case 'HUBMESSAGE':
      return metadata.hubmessageChannelId
    case 'NONE':
      return null
  }
}

/**
 * Achata os itens das assinaturas numa lista de linhas.
 *
 * Assinatura cancelada não entra: os itens dela não são linhas do cliente, e
 * incluí-los divergiria da contagem de `connectorQuantity`. Item cancelado
 * dentro de assinatura viva **entra**, com o próprio status — esconder faria a
 * linha desaparecer da tela antes do fim do período pago.
 */
export function listSubscriptionLines(
  subscriptions: readonly SubscriptionView[] | undefined | null,
): SubscriptionLine[] {
  if (!subscriptions) return []

  return subscriptions
    .filter(subscription => subscription.status !== 'cancelled')
    .flatMap(subscription =>
      subscription.items.map(item => ({
        id: item.id,
        name: item.name,
        status: item.status,
        provider: item.metadata.provider,
        subscriptionId: subscription.id,
        planName: subscription.plan?.name ?? '',
        providerRef: providerRef(item.metadata),
      })),
    )
}

/** Linhas ativas — o que o cliente pode usar agora. */
export const countActiveLines = (lines: readonly SubscriptionLine[]): number =>
  lines.filter(line => line.status === 'active').length
