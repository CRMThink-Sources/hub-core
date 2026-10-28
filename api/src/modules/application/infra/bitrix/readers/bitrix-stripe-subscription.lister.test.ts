import { describe, expect, it, vi } from 'vitest'
import { BitrixStripeSubscriptionLister } from './bitrix-stripe-subscription.lister'

describe('BitrixStripeSubscriptionLister', () => {
  it('filtra a modalidade stripe, pede só os campos da escolha e pagina', async () => {
    const listCrmItems = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          items: [
            { id: 10, ufCrm91GatewayId: 'sub_1', ufCrm91Environment: '' },
            {
              id: 11,
              ufCrm91GatewayId: 'sub_2',
              ufCrm91Environment: 'homolog',
            },
          ],
        },
        next: 50,
      })
      .mockResolvedValueOnce({
        result: { items: [{ id: 12, ufCrm91GatewayId: null }] },
      })

    const refs = await new BitrixStripeSubscriptionLister({
      listCrmItems,
    }).listStripeSubscriptions()

    expect(refs).toEqual([
      { id: '10', gatewayId: 'sub_1', environment: null },
      { id: '11', gatewayId: 'sub_2', environment: 'homolog' },
      { id: '12', gatewayId: null, environment: null },
    ])
    expect(listCrmItems).toHaveBeenCalledWith(
      1142,
      { ufCrm91Modality: 'stripe' },
      { select: ['id', 'ufCrm91GatewayId', 'ufCrm91Environment'] },
    )
    expect(listCrmItems.mock.calls[1]?.[2]).toMatchObject({ start: 50 })
  })
})
