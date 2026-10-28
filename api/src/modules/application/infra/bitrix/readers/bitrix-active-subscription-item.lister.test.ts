import { describe, expect, it, vi } from 'vitest'
import { BitrixActiveSubscriptionItemLister } from './bitrix-active-subscription-item.lister'

describe('BitrixActiveSubscriptionItemLister', () => {
  it('lista os itens ativos da 1146 com o pai, paginando', async () => {
    const listCrmItems = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          items: [
            { id: 9001, parentId1142: 501 },
            { id: 9002, parentId1142: 0 },
          ],
        },
        next: 50,
      })
      .mockResolvedValueOnce({
        result: { items: [{ id: 9003, parentId1142: '777' }] },
      })

    const items = await new BitrixActiveSubscriptionItemLister({
      listCrmItems,
    }).listActiveItems()

    expect(items).toEqual([
      { itemId: '9001', subscriptionId: '501' },
      { itemId: '9002', subscriptionId: null },
      { itemId: '9003', subscriptionId: '777' },
    ])
    expect(listCrmItems).toHaveBeenCalledWith(
      1146,
      { ufCrm93Status: '13625' },
      { select: ['id', 'parentId1142'] },
    )
    expect(listCrmItems.mock.calls[1]?.[2]).toMatchObject({ start: 50 })
  })
})
