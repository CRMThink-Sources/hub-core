import { describe, expect, it } from 'vitest'
import Stripe from 'stripe'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import {
  getConnectorQuantityForPrice,
  resolveProviderQuantities,
} from './thinkzap-subscription-line'

function sub(
  items: Array<{ priceId: string; quantity: number }>,
): Stripe.Subscription {
  return {
    items: {
      data: items.map(i => ({
        price: { id: i.priceId },
        quantity: i.quantity,
      })),
    },
  } as unknown as Stripe.Subscription
}

const prices = {
  [ConnectorProvider.ZAPI]: 'price_zapi',
  [ConnectorProvider.HUBMESSAGE]: 'price_hub',
}

describe('thinkzap-subscription-line', () => {
  it('getConnectorQuantityForPrice retorna 0 sem fallback quando price ausente', () => {
    const s = sub([{ priceId: 'price_zapi', quantity: 3 }])
    expect(getConnectorQuantityForPrice(s, 'price_hub')).toBe(0)
    expect(getConnectorQuantityForPrice(s, 'price_zapi')).toBe(3)
  })

  it('resolveProviderQuantities mapeia dois line items com quantidades distintas', () => {
    const s = sub([
      { priceId: 'price_zapi', quantity: 3 },
      { priceId: 'price_hub', quantity: 2 },
    ])
    const result = resolveProviderQuantities(s, prices)
    expect(result).toEqual([
      { provider: ConnectorProvider.ZAPI, quantity: 3 },
      { provider: ConnectorProvider.HUBMESSAGE, quantity: 2 },
    ])
  })

  it('resolveProviderQuantities retorna 0 para o produto não presente na assinatura', () => {
    const s = sub([{ priceId: 'price_zapi', quantity: 5 }])
    const result = resolveProviderQuantities(s, prices)
    expect(result).toContainEqual({
      provider: ConnectorProvider.HUBMESSAGE,
      quantity: 0,
    })
  })
})
