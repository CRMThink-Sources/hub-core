import Stripe from 'stripe'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'

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

/**
 * Quantidade estrita do line item cujo price === priceId. Retorna 0 quando não
 * há line item para esse produto (não faz fallback — necessário no multi-produto).
 */
export function getConnectorQuantityForPrice(
  subscription: Stripe.Subscription,
  priceId: string,
): number {
  if (!priceId) return 0
  const match = subscription.items.data.find(item => item.price.id === priceId)
  return match?.quantity ?? 0
}

export type ProviderPriceMap = {
  [ConnectorProvider.ZAPI]: string
  [ConnectorProvider.HUBMESSAGE]: string
}

export type ProviderQuantity = {
  provider: ConnectorProvider
  quantity: number
}

/**
 * Mapeia cada line item conhecido para a quantidade do provider correspondente.
 * Um único assinatura pode conter os dois produtos (Z-API e HubMessage).
 */
export function resolveProviderQuantities(
  subscription: Stripe.Subscription,
  prices: ProviderPriceMap,
): ProviderQuantity[] {
  const result: ProviderQuantity[] = []
  for (const provider of [
    ConnectorProvider.ZAPI,
    ConnectorProvider.HUBMESSAGE,
  ]) {
    const priceId = prices[provider]
    if (!priceId) continue
    result.push({
      provider,
      quantity: getConnectorQuantityForPrice(subscription, priceId),
    })
  }
  return result
}
