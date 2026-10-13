import { describe, expect, it, vi } from 'vitest'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixSubscriptionItemIdLister } from './bitrix-subscription-item-id.lister'

const makeLister = (pages: Array<{ items: unknown[]; next?: number }>) => {
  const listCrmItems = vi.fn()
  for (const page of pages) {
    listCrmItems.mockResolvedValueOnce({
      result: { items: page.items },
      ...(page.next !== undefined && { next: page.next }),
    })
  }
  return {
    lister: new BitrixSubscriptionItemIdLister({
      listCrmItems,
    } as unknown as BitrixClient),
    listCrmItems,
  }
}

describe('BitrixSubscriptionItemIdLister', () => {
  it('filtra pelo pai na SPA 1146 e pede só o id', async () => {
    const { lister, listCrmItems } = makeLister([
      { items: [{ id: 10 }, { id: '11' }] },
    ])

    await expect(lister.listSubscriptionItemIds('501')).resolves.toEqual([
      '10',
      '11',
    ])
    expect(listCrmItems).toHaveBeenCalledWith(
      1146,
      { parentId1142: '501' },
      { select: ['id'] },
    )
  })

  /** Linha fora da primeira página seria linha paga nunca assinada no provider. */
  it('pagina pelo next até a última página', async () => {
    const { lister, listCrmItems } = makeLister([
      { items: [{ id: 1 }], next: 50 },
      { items: [{ id: 2 }] },
    ])

    await expect(lister.listSubscriptionItemIds('501')).resolves.toEqual([
      '1',
      '2',
    ])
    expect(listCrmItems).toHaveBeenCalledTimes(2)
    expect(listCrmItems.mock.calls[1]?.[2]).toEqual({
      select: ['id'],
      start: 50,
    })
  })

  it('assinatura sem itens devolve lista vazia', async () => {
    const { lister } = makeLister([{ items: [] }])

    await expect(lister.listSubscriptionItemIds('501')).resolves.toEqual([])
  })
})
