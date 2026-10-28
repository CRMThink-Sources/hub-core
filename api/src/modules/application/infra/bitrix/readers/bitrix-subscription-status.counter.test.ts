import { describe, expect, it, vi } from 'vitest'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixSubscriptionStatusCounter } from './bitrix-subscription-status.counter'

const NOW = new Date('2026-10-28T12:00:00Z')

/** Devolve o `total` conforme o status filtrado. */
const makeCounter = (totals: Record<string, number | undefined>) => {
  const listCrmItems = vi.fn(
    (_entityTypeId: number, filter: Record<string, unknown>) =>
      Promise.resolve({
        result: { items: [] },
        total: totals[filter.ufCrm91Status as string],
      }),
  )
  return {
    counter: new BitrixSubscriptionStatusCounter(
      { listCrmItems } as unknown as BitrixClient,
      () => NOW,
    ),
    listCrmItems,
  }
}

describe('BitrixSubscriptionStatusCounter', () => {
  it('conta ativas, vencidas e em teste pelo total de cada filtro', async () => {
    const { counter } = makeCounter({ '13617': 94, '13621': 6, '13619': 12 })

    await expect(counter.count()).resolves.toEqual({
      active: 94,
      pastDue: 6,
      trialing: 12,
      countedAt: NOW,
    })
  })

  it('filtra a SPA 1142 por um status por vez e pede só o id', async () => {
    const { counter, listCrmItems } = makeCounter({
      '13617': 0,
      '13621': 0,
      '13619': 0,
    })

    await counter.count()

    expect(listCrmItems).toHaveBeenCalledTimes(3)
    for (const status of ['13617', '13621', '13619']) {
      expect(listCrmItems).toHaveBeenCalledWith(
        1142,
        { ufCrm91Status: status },
        { select: ['id'] },
      )
    }
  })

  it('zero é contagem, não falha', async () => {
    const { counter } = makeCounter({ '13617': 0, '13621': 0, '13619': 0 })

    await expect(counter.count()).resolves.toMatchObject({
      active: 0,
      pastDue: 0,
      trialing: 0,
    })
  })

  it('falha quando o Bitrix não devolve total', async () => {
    const { counter } = makeCounter({ '13617': 5, '13621': undefined })

    await expect(counter.count()).rejects.toThrow('sem total')
  })
})
