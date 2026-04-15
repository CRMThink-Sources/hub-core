import Stripe from 'stripe'

/** Quantidade de linhas no item da assinatura que usa o price do ThinkZap. */
export function getThinkzapConnectorQuantity(
  subscription: Stripe.Subscription,
  thinkzapPriceId: string,
): number {
  const match = subscription.items.data.find(
    item => item.price.id === thinkzapPriceId,
  )
  const item = match ?? subscription.items.data[0]
  return item?.quantity ?? 0
}
