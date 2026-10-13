import { describe, expect, it, vi } from 'vitest'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixExpiringSubscriptionLister } from './bitrix-expiring-subscription.lister'

const makeLister = (pages: Array<{ items: unknown[]; next?: number }>) => {
  const listCrmItems = vi.fn()
  for (const page of pages) {
    listCrmItems.mockResolvedValueOnce({
      result: { items: page.items },
      ...(page.next !== undefined && { next: page.next }),
    })
  }
  return {
    lister: new BitrixExpiringSubscriptionLister({
      listCrmItems,
    } as unknown as BitrixClient),
    listCrmItems,
  }
}

const NOW = new Date('2026-10-13T15:00:00Z')

const item = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  ufCrm91Status: '13617',
  ufCrm91CurrentPeriodEnd: '2026-10-10T00:00:00+03:00',
  ufCrm91Modality: 'manual',
  ...overrides,
})

describe('BitrixExpiringSubscriptionLister', () => {
  it('filtra trial e ativa com fim até hoje e pede só os campos da regra', async () => {
    const { lister, listCrmItems } = makeLister([{ items: [item()] }])

    await expect(lister.listExpiring(NOW)).resolves.toEqual([
      {
        id: '7',
        status: 'active',
        currentPeriodEnd: new Date('2026-10-10T23:59:59.999Z'),
        modality: 'manual',
      },
    ])
    expect(listCrmItems).toHaveBeenCalledWith(
      1142,
      {
        ufCrm91Status: ['13619', '13617'],
        '<=ufCrm91CurrentPeriodEnd': '2026-10-13',
      },
      {
        select: [
          'id',
          'ufCrm91Status',
          'ufCrm91CurrentPeriodEnd',
          'ufCrm91Modality',
        ],
      },
    )
  })

  it('pagina pelo next até a última página', async () => {
    const { lister, listCrmItems } = makeLister([
      { items: [item({ id: 1 })], next: 50 },
      { items: [item({ id: 2, ufCrm91Status: '13619' })] },
    ])

    const result = await lister.listExpiring(NOW)

    expect(result.map(s => [s.id, s.status])).toEqual([
      ['1', 'active'],
      ['2', 'trialing'],
    ])
    expect(listCrmItems).toHaveBeenCalledTimes(2)
    expect(listCrmItems.mock.calls[1]?.[2]).toMatchObject({ start: 50 })
  })

  it('ignora item com data inválida e devolve os outros', async () => {
    const { lister } = makeLister([
      {
        items: [item({ id: 1, ufCrm91CurrentPeriodEnd: '' }), item({ id: 2 })],
      },
    ])

    const result = await lister.listExpiring(NOW)

    expect(result.map(s => s.id)).toEqual(['2'])
  })

  it('modalidade vazia resolve manual', async () => {
    const { lister } = makeLister([{ items: [item({ ufCrm91Modality: '' })] }])

    const [subscription] = await lister.listExpiring(NOW)

    expect(subscription?.modality).toBe('manual')
  })
})
