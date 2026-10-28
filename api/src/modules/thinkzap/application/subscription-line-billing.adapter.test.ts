import { describe, expect, it, vi } from 'vitest'
import { BitrixMethodPausedError } from '@/shared/infra/bitrix-limits/bitrix-limits.port'
import { SubscriptionLineBillingAdapter } from './subscription-line-billing.adapter'
import type { SyncSpaItemResourceStatusResult } from './sync-spa-item-resource-status'

const build = (
  execute: (input: {
    itemId: string
  }) => Promise<SyncSpaItemResourceStatusResult>,
  options: {
    itemIds?: string[]
    activeItems?: Array<{ itemId: string; subscriptionId: string | null }>
  } = {},
) => {
  const syncItem = { execute: vi.fn(execute) }
  return {
    adapter: new SubscriptionLineBillingAdapter(
      {
        listSubscriptionItemIds: vi.fn(() =>
          Promise.resolve(options.itemIds ?? []),
        ),
      },
      {
        listActiveItems: vi.fn(() =>
          Promise.resolve(options.activeItems ?? []),
        ),
      },
      syncItem,
    ),
    syncItem,
  }
}

describe('SubscriptionLineBillingAdapter.unsubscribeLinesForPastDue', () => {
  it('desassina cada linha no modo do quinto dia e devolve só as desassinadas agora', async () => {
    const { adapter, syncItem } = build(
      ({ itemId }) =>
        Promise.resolve(
          itemId === '9001'
            ? { outcome: 'unsubscribed', provider: 'ZAPI' }
            : { outcome: 'noop' },
        ),
      { itemIds: ['9001', '9002'] },
    )

    await expect(adapter.unsubscribeLinesForPastDue('501')).resolves.toEqual([
      {
        itemId: '9001',
        subscriptionId: '501',
        provider: 'ZAPI',
        action: 'unsubscribed',
        succeeded: true,
      },
    ])
    expect(syncItem.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: '9002',
        parentStatus: 'past_due',
        mode: 'past-due-expired',
      }),
    )
  })

  it('falha em uma linha não trava a outra', async () => {
    const { adapter } = build(
      ({ itemId }) =>
        itemId === '9001'
          ? Promise.reject(new Error('z-api fora'))
          : Promise.resolve({
              outcome: 'unsubscribed',
              provider: 'HUBMESSAGE',
            }),
      { itemIds: ['9001', '9002'] },
    )

    const results = await adapter.unsubscribeLinesForPastDue('501')

    expect(results).toEqual([
      expect.objectContaining({
        itemId: '9001',
        succeeded: false,
        error: 'z-api fora',
      }),
      expect.objectContaining({
        itemId: '9002',
        provider: 'HUBMESSAGE',
        succeeded: true,
      }),
    ])
  })

  it('a pausa do Bitrix sobe', async () => {
    const { adapter } = build(
      () =>
        Promise.reject(
          new BitrixMethodPausedError(
            'crm.item.get',
            'portal.bitrix24.com.br',
            1000,
          ),
        ),
      { itemIds: ['9001'] },
    )

    await expect(
      adapter.unsubscribeLinesForPastDue('501'),
    ).rejects.toBeInstanceOf(BitrixMethodPausedError)
  })
})

describe('SubscriptionLineBillingAdapter.reconcileActiveLines', () => {
  it('só verifica linhas de assinaturas ativas e registra só as assinadas agora', async () => {
    const { adapter, syncItem } = build(
      ({ itemId }) =>
        Promise.resolve(
          itemId === '9001'
            ? { outcome: 'subscribed', provider: 'ZAPI' }
            : { outcome: 'already-subscribed', provider: 'ZAPI' },
        ),
      {
        activeItems: [
          { itemId: '9001', subscriptionId: '501' },
          { itemId: '9002', subscriptionId: '501' },
          { itemId: '9003', subscriptionId: '777' },
          { itemId: '9004', subscriptionId: null },
        ],
      },
    )

    const result = await adapter.reconcileActiveLines(['501'])

    expect(result.checked).toBe(2)
    expect(result.results).toEqual([
      {
        itemId: '9001',
        subscriptionId: '501',
        provider: 'ZAPI',
        action: 'subscribed',
        succeeded: true,
      },
    ])
    expect(syncItem.execute).toHaveBeenCalledTimes(2)
    expect(syncItem.execute).toHaveBeenCalledWith(
      expect.objectContaining({ parentStatus: 'active', mode: 'reconcile' }),
    )
  })

  it('falha na reconciliação vira resultado com erro', async () => {
    const { adapter } = build(
      () => Promise.reject(new Error('hubmessage 500')),
      {
        activeItems: [{ itemId: '9001', subscriptionId: '501' }],
      },
    )

    const result = await adapter.reconcileActiveLines(['501'])

    expect(result).toEqual({
      checked: 1,
      results: [
        expect.objectContaining({
          itemId: '9001',
          action: 'subscribed',
          succeeded: false,
          error: 'hubmessage 500',
        }),
      ],
    })
  })
})
