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
    credentialItems?: Array<{
      itemId: string
      subscriptionId: string | null
      status: 'active' | 'cancelled' | null
    }>
    unsubscribedItemIds?: string[]
    limit?: number
    provisionLimit?: number
    requestProvisioning?: (itemId: string) => Promise<unknown>
  } = {},
) => {
  const syncItem = { execute: vi.fn(execute) }
  const requestProvisioning = vi.fn(
    options.requestProvisioning ?? (() => Promise.resolve()),
  )
  return {
    requestProvisioning,
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
        listItemsWithCredential: vi.fn(() =>
          Promise.resolve(options.credentialItems ?? []),
        ),
      },
      syncItem,
      {
        find: vi.fn((itemId: string) =>
          Promise.resolve(
            options.unsubscribedItemIds?.includes(itemId)
              ? {
                  provider: 'ZAPI' as const,
                  instanceId: 'i',
                  subscriptionId: '1',
                  unsubscribedAt: '2026-11-01T00:00:00.000Z',
                }
              : null,
          ),
        ),
      },
      requestProvisioning,
      options.limit,
      options.provisionLimit,
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

  it('reconciliação vira resultado com erro quando a linha falha', async () => {
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

describe('SubscriptionLineBillingAdapter.reconcileCancelledLines', () => {
  const unsubscribed = (itemId: string) =>
    Promise.resolve<SyncSpaItemResourceStatusResult>(
      itemId === 'x'
        ? { outcome: 'noop' }
        : { outcome: 'unsubscribed', provider: 'ZAPI' },
    )

  it('desassina linha cancelada e linha de assinatura cancelada; ignora ativa de assinatura viva', async () => {
    const { adapter, syncItem } = build(({ itemId }) => unsubscribed(itemId), {
      credentialItems: [
        { itemId: '9001', subscriptionId: '501', status: 'cancelled' },
        { itemId: '9002', subscriptionId: '600', status: 'active' },
        { itemId: '9003', subscriptionId: '501', status: 'active' },
        { itemId: '9004', subscriptionId: null, status: 'cancelled' },
      ],
    })

    const result = await adapter.reconcileCancelledLines(['600'])

    expect(result.checked).toBe(2)
    expect(result.results.map(line => line.itemId).sort()).toEqual([
      '9001',
      '9002',
    ])
    expect(syncItem.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: '9001',
        parentStatus: null,
        mode: 'reconcile',
      }),
    )
    expect(syncItem.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: '9002',
        parentStatus: 'cancelled',
        mode: 'reconcile',
      }),
    )
  })

  it('não relê no Bitrix linha que já tem a marca de desassinado', async () => {
    const { adapter, syncItem } = build(({ itemId }) => unsubscribed(itemId), {
      credentialItems: [
        { itemId: '9001', subscriptionId: '501', status: 'cancelled' },
      ],
      unsubscribedItemIds: ['9001'],
    })

    const result = await adapter.reconcileCancelledLines([])

    expect(result).toEqual({ checked: 0, results: [] })
    expect(syncItem.execute).not.toHaveBeenCalled()
  })

  it('para no teto de chamadas ao provider por rodada', async () => {
    const { adapter, syncItem } = build(({ itemId }) => unsubscribed(itemId), {
      credentialItems: ['1', '2', '3', '4'].map(itemId => ({
        itemId,
        subscriptionId: '501',
        status: 'cancelled' as const,
      })),
      limit: 2,
    })

    const result = await adapter.reconcileCancelledLines([])

    expect(result.results).toHaveLength(2)
    expect(syncItem.execute).toHaveBeenCalledTimes(2)
  })

  it('linha sem chamada ao provider (noop, recurso compartilhado) não consome o teto', async () => {
    const { adapter } = build(({ itemId }) => unsubscribed(itemId), {
      credentialItems: ['x', 'x', '3'].map(itemId => ({
        itemId,
        subscriptionId: '501',
        status: 'cancelled' as const,
      })),
      limit: 1,
    })

    const result = await adapter.reconcileCancelledLines([])

    expect(result.results.map(line => line.itemId)).toEqual(['3'])
  })

  it('falha não consome o teto de desassinaturas', async () => {
    const { adapter } = build(
      ({ itemId }) =>
        itemId === 'ruim'
          ? Promise.reject(new Error('instância inexistente'))
          : unsubscribed(itemId),
      {
        credentialItems: ['ruim', 'ruim', 'ruim', 'boa'].map(itemId => ({
          itemId,
          subscriptionId: '501',
          status: 'cancelled' as const,
        })),
        limit: 1,
      },
    )

    const result = await adapter.reconcileCancelledLines([])

    expect(
      result.results.filter(line => line.succeeded).map(line => line.itemId),
    ).toEqual(['boa'])
  })

  it('falha numa linha vira resultado; a pausa do Bitrix sobe', async () => {
    const { adapter } = build(() => Promise.reject(new Error('z-api fora')), {
      credentialItems: [
        { itemId: '9001', subscriptionId: '501', status: 'cancelled' },
      ],
    })

    await expect(adapter.reconcileCancelledLines([])).resolves.toEqual({
      checked: 1,
      results: [
        expect.objectContaining({
          itemId: '9001',
          action: 'unsubscribed',
          succeeded: false,
          error: 'z-api fora',
        }),
      ],
    })

    const paused = build(
      () =>
        Promise.reject(
          new BitrixMethodPausedError('crm.item.get', 'portal', 1000),
        ),
      {
        credentialItems: [
          { itemId: '9001', subscriptionId: '501', status: 'cancelled' },
        ],
      },
    )
    await expect(
      paused.adapter.reconcileCancelledLines([]),
    ).rejects.toBeInstanceOf(BitrixMethodPausedError)
  })
})

describe('SubscriptionLineBillingAdapter.reconcileActiveLines — provisionamento pendente', () => {
  /**
   * Regressão: item que perdeu o ADD, ou cujo provisionamento falhou nas três
   * tentativas, ficava sem credencial para sempre — "criou e não ativou".
   */
  it('reenvia ao provisionamento a linha ativa que declara provider e não tem credencial', async () => {
    const { adapter, requestProvisioning } = build(
      ({ itemId }) =>
        Promise.resolve<SyncSpaItemResourceStatusResult>(
          itemId === '9001'
            ? { outcome: 'no-credential', provider: 'ZAPI' }
            : itemId === '9002'
              ? { outcome: 'no-credential' }
              : { outcome: 'already-subscribed', provider: 'ZAPI' },
        ),
      {
        activeItems: [
          { itemId: '9001', subscriptionId: '501' },
          { itemId: '9002', subscriptionId: '501' },
          { itemId: '9003', subscriptionId: '501' },
        ],
        provisionLimit: 20,
      },
    )

    const result = await adapter.reconcileActiveLines(['501'])

    expect(requestProvisioning).toHaveBeenCalledTimes(1)
    expect(requestProvisioning).toHaveBeenCalledWith('9001')
    expect(result.results).toEqual([])
  })

  it('sem teto configurado só lista as candidatas, sem provisionar', async () => {
    const { adapter, requestProvisioning } = build(
      () =>
        Promise.resolve<SyncSpaItemResourceStatusResult>({
          outcome: 'no-credential',
          provider: 'ZAPI',
        }),
      { activeItems: [{ itemId: '9001', subscriptionId: '501' }] },
    )

    await adapter.reconcileActiveLines(['501'])

    expect(requestProvisioning).not.toHaveBeenCalled()
  })

  it('respeita o teto de provisionamentos por rodada', async () => {
    const { adapter, requestProvisioning } = build(
      () =>
        Promise.resolve<SyncSpaItemResourceStatusResult>({
          outcome: 'no-credential',
          provider: 'HUBMESSAGE',
        }),
      {
        activeItems: ['1', '2', '3'].map(itemId => ({
          itemId,
          subscriptionId: '501',
        })),
        provisionLimit: 2,
      },
    )

    await adapter.reconcileActiveLines(['501'])

    expect(requestProvisioning).toHaveBeenCalledTimes(2)
  })

  it('falha ao enfileirar não vira falha de assinatura nem trava as outras linhas', async () => {
    const { adapter, syncItem } = build(
      ({ itemId }) =>
        Promise.resolve<SyncSpaItemResourceStatusResult>(
          itemId === '9001'
            ? { outcome: 'no-credential', provider: 'ZAPI' }
            : { outcome: 'subscribed', provider: 'ZAPI' },
        ),
      {
        activeItems: [
          { itemId: '9001', subscriptionId: '501' },
          { itemId: '9002', subscriptionId: '501' },
        ],
        requestProvisioning: () => Promise.reject(new Error('redis fora')),
        provisionLimit: 20,
      },
    )

    const result = await adapter.reconcileActiveLines(['501'])

    expect(syncItem.execute).toHaveBeenCalledTimes(2)
    expect(result.results).toEqual([
      expect.objectContaining({ itemId: '9002', succeeded: true }),
    ])
  })
})
