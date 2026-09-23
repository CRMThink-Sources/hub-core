import { describe, expect, it, vi } from 'vitest'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixLineItemByRemoteIdFinder } from './bitrix-line-item-by-remote-id.finder'

const makeFinder = (
  pages: Array<{ items: Record<string, unknown>[]; next?: number }>,
) => {
  const listCrmItems = vi.fn()
  for (const page of pages) {
    listCrmItems.mockResolvedValueOnce({
      result: { items: page.items },
      ...(page.next !== undefined && { next: page.next }),
    })
  }
  return {
    finder: new BitrixLineItemByRemoteIdFinder(
      { listCrmItems } as unknown as BitrixClient,
      1146,
    ),
    listCrmItems,
  }
}

describe('BitrixLineItemByRemoteIdFinder', () => {
  it('filtra pelo instanceId da Z-API e devolve estado e token', async () => {
    const { finder, listCrmItems } = makeFinder([
      {
        items: [
          { id: 10, ufCrm93Connected: 'Sim', ufCrm93ZApiInstanceToken: 'tok' },
        ],
      },
    ])

    await expect(finder.findLiveByZApiInstanceId('inst-1')).resolves.toEqual([
      { id: '10', connected: true, zApiInstanceToken: 'tok' },
    ])
    expect(listCrmItems.mock.calls[0]?.[0]).toBe(1146)
    expect(listCrmItems.mock.calls[0]?.[1]).toEqual({
      '=ufCrm93ZApiInstanceId': 'inst-1',
    })
  })

  it('filtra pelo channelId da HubMessage', async () => {
    const { finder, listCrmItems } = makeFinder([
      { items: [{ id: 11, ufCrm93Connected: '' }] },
    ])

    await expect(finder.findLiveByHubMessageChannelId('ch-1')).resolves.toEqual(
      [{ id: '11', connected: null }],
    )
    expect(listCrmItems.mock.calls[0]?.[1]).toEqual({
      '=ufCrm93HubChanelId': 'ch-1',
    })
  })

  it('ignora itens com exclusão lógica', async () => {
    const { finder } = makeFinder([
      {
        items: [
          { id: 1, ufCrm93DeletedAt: '2026-09-10T12:00:00+03:00' },
          { id: 2, ufCrm93DeletedAt: '', ufCrm93Connected: 'Não' },
        ],
      },
    ])

    await expect(finder.findLiveByHubMessageChannelId('ch')).resolves.toEqual([
      { id: '2', connected: false },
    ])
  })

  it('segue o cursor de paginação', async () => {
    const { finder, listCrmItems } = makeFinder([
      { items: [{ id: 1 }], next: 50 },
      { items: [{ id: 2 }] },
    ])

    const found = await finder.findLiveByZApiInstanceId('inst')

    expect(found.map(item => item.id)).toEqual(['1', '2'])
    expect(listCrmItems.mock.calls[1]?.[2]).toMatchObject({ start: 50 })
  })
})
