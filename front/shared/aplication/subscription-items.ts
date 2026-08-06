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

/**
 * Habilitação da assinatura pai, derivada dela e do agora.
 *
 * Espelha `resolveLineEntitlement` do api (`thinkzap/domain/connector-trial.ts`),
 * de propósito: o payload de `/api/application/me` traz `status` e
 * `currentPeriodEnd`, que é tudo de que a decisão precisa, e expor `entitlement`
 * no contrato de leitura de contexto ampliaria o contrato por causa de um
 * consumidor. A duplicação é contida — o guard de envio no backend continua sendo
 * a autoridade, então divergir aqui não autoriza nada indevido.
 *
 * `trialing` vale enquanto `now <= currentPeriodEnd`: `>` e não `>=`, porque o
 * último instante da janela ainda é do cliente. Status desconhecido não habilita
 * — é decisão de autorização, e um `default` permissivo faria linha inválida
 * aparecer no widget.
 */
const isSubscriptionEnabled = (
  subscription: SubscriptionView,
  now: Date,
): boolean => {
  switch (subscription.status) {
    case 'active':
      return true
    case 'trialing':
      return now.getTime() <= new Date(subscription.currentPeriodEnd).getTime()
    case 'cancelled':
    case 'past_due':
      return false
    default:
      return false
  }
}

/**
 * Linhas que o widget de conversa pode oferecer para envio.
 *
 * **Ofertável não é o mesmo que visível.** `listSubscriptionLines` existe para a
 * tela de conexões, que mostra de propósito linha bloqueada e item cancelado — o
 * cliente tem que ver o que tinha e por que parou. O widget existe para mandar
 * mensagem: oferecer uma linha que o envio vai recusar só gera erro na cara do
 * operador. São dois conjuntos diferentes, e uma função com flag serviria os dois
 * errado.
 *
 * Fora ficam: item de assinatura sem entitlement `active`, item `cancelled` e item
 * de cobrança sem conector (`provider: 'NONE'`, que não é linha).
 *
 * `now` entra por parâmetro em vez de `new Date()` aqui dentro: a função é pura, o
 * chamador decide o instante e o teste não precisa de relógio falso. Consequência
 * aceita: a lista não se atualiza sozinha quando o trial vence com a aba aberta —
 * o próximo render corrige, e o envio já era recusado pelo backend nesse meio.
 *
 * Ver spec `widget-line-listing`.
 */
export function listSendableLines(
  subscriptions: readonly SubscriptionView[] | undefined | null,
  now: Date,
): SubscriptionLine[] {
  if (!subscriptions) return []

  return subscriptions
    .filter(subscription => isSubscriptionEnabled(subscription, now))
    .flatMap(subscription =>
      subscription.items
        .filter(
          item => item.status === 'active' && item.metadata.provider !== 'NONE',
        )
        .map(item => ({
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
