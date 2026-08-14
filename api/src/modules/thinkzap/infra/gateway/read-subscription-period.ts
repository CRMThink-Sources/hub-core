/**
 * O período de cobrança de uma assinatura do gateway, tolerante a **onde** ele está.
 *
 * `current_period_start/end` viveram na assinatura e passaram a viver no item de
 * linha nas versões novas da API. Ler só um dos dois lugares deixaria o período
 * indefinido dependendo da versão de API da conta — e período inválido reprova o item
 * inteiro no mapper da SPA, o que apareceria como "pagou e a linha não voltou".
 *
 * Função pura e sem log: devolve `null` quando nenhum dos dois lugares trouxe o
 * período, e quem chama decide o que fazer com a ausência. O gateway registra o erro
 * e lança, porque ali é um pagamento que não pode ser espelhado; o backfill de
 * cobrança legada pula a instalação e a reporta, porque ali é um caso a resolver à
 * mão. Uma regra de leitura, duas políticas de falha.
 *
 * **Sem importar o pacote do gateway**, de propósito: a entrada é declarada
 * estruturalmente, e `Stripe.Subscription` satisfaz o shape. Importar o SDK aqui
 * furaria `runtime-gateway-isolation`, que afirma que o pacote entra em **um** arquivo
 * fora de `scripts/` — e essa asserção é o que impede o gateway de reaparecer no
 * caminho quente por um import transitivo.
 */

/** O que este módulo precisa de uma assinatura do gateway, e nada além. */
export type SubscriptionWithPeriod = {
  current_period_start?: number | null
  current_period_end?: number | null
  items?: {
    data?: Array<{
      current_period_start?: number | null
      current_period_end?: number | null
    }>
  }
}

export type SubscriptionPeriod = {
  currentPeriodStart: Date
  currentPeriodEnd: Date
}

export function readSubscriptionPeriod(
  subscription: SubscriptionWithPeriod,
): SubscriptionPeriod | null {
  const item = subscription.items?.data?.[0]

  const start = subscription.current_period_start ?? item?.current_period_start
  const end = subscription.current_period_end ?? item?.current_period_end

  if (!start || !end) return null

  return {
    currentPeriodStart: new Date(start * 1000),
    currentPeriodEnd: new Date(end * 1000),
  }
}
