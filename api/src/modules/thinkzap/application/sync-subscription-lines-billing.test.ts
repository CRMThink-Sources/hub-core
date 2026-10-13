import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SubscriptionLinesBillingError,
  SyncSubscriptionLinesBilling,
} from './sync-subscription-lines-billing'
import type { SyncSpaItemResourceStatusOutcome } from './sync-spa-item-resource-status'
import type { SubscriptionItemIdLister } from '@/modules/thinkzap/domain/ports/subscription-item-id-lister.port'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const INPUT = { subscriptionId: '501', traceKey: 'spa-subscription-501' }

const makeLister = (ids: string[]) => {
  const listSubscriptionItemIds = vi.fn(() => Promise.resolve(ids))
  return {
    lister: { listSubscriptionItemIds } as SubscriptionItemIdLister,
    listSubscriptionItemIds,
  }
}

/**
 * O caso de uso por item, dublado por desfecho. `Error` no mapa é a falha do provider —
 * a mesma que o caso de uso real propaga para a fila.
 */
const makeSyncItem = (
  byItem: Record<string, SyncSpaItemResourceStatusOutcome | Error>,
) => {
  const execute = vi.fn(({ itemId }: { itemId: string }) => {
    const outcome = byItem[itemId] ?? 'noop'
    return outcome instanceof Error
      ? Promise.reject(outcome)
      : Promise.resolve({ outcome })
  })
  return { syncItem: { execute }, execute }
}

describe('SyncSubscriptionLinesBilling', () => {
  beforeEach(() => vi.clearAllMocks())

  /**
   * A assinatura manual passada para "Ativo" no CRM: duas linhas provisionadas, nenhuma
   * assinada ainda. As duas passam pela regra do item.
   */
  it('reconcilia cada linha da assinatura pelo caso de uso do item', async () => {
    const { lister, listSubscriptionItemIds } = makeLister(['77', '78'])
    const { syncItem, execute } = makeSyncItem({
      '77': 'subscribed',
      '78': 'subscribed',
    })

    const result = await new SyncSubscriptionLinesBilling(
      lister,
      syncItem,
    ).execute(INPUT)

    expect(listSubscriptionItemIds).toHaveBeenCalledWith('501')
    expect(execute).toHaveBeenCalledWith({
      itemId: '77',
      traceKey: 'spa-subscription-501',
    })
    expect(execute).toHaveBeenCalledWith({
      itemId: '78',
      traceKey: 'spa-subscription-501',
    })
    expect(result).toEqual({ items: 2, subscribed: 2, failed: 0 })
  })

  it('assinatura já em dia termina sem assinar nada', async () => {
    const { lister } = makeLister(['77', '78'])
    const { syncItem } = makeSyncItem({})

    const result = await new SyncSubscriptionLinesBilling(
      lister,
      syncItem,
    ).execute(INPUT)

    expect(result).toEqual({ items: 2, subscribed: 0, failed: 0 })
  })

  it('falha em uma linha não impede as outras, e o job lança para retentar', async () => {
    const { lister } = makeLister(['77', '78'])
    const { syncItem, execute } = makeSyncItem({
      '77': new Error('provider fora'),
      '78': 'subscribed',
    })

    const run = new SyncSubscriptionLinesBilling(lister, syncItem).execute(
      INPUT,
    )

    await expect(run).rejects.toBeInstanceOf(SubscriptionLinesBillingError)
    await expect(run).rejects.toMatchObject({ failedItemIds: ['77'] })
    expect(execute).toHaveBeenCalledTimes(2)
  })

  /**
   * O retry da fila: a linha assinada na primeira tentativa tem a marca e termina em
   * `noop` no caso de uso do item — não há segunda chamada ao provider para ela.
   */
  it('no retry, só a linha que falhou volta a ser assinada', async () => {
    const { lister } = makeLister(['77', '78'])
    const { syncItem } = makeSyncItem({ '77': 'subscribed', '78': 'noop' })

    const result = await new SyncSubscriptionLinesBilling(
      lister,
      syncItem,
    ).execute(INPUT)

    expect(result).toEqual({ items: 2, subscribed: 1, failed: 0 })
  })

  it('assinatura sem itens não faz nada', async () => {
    const { lister } = makeLister([])
    const { syncItem, execute } = makeSyncItem({})

    const result = await new SyncSubscriptionLinesBilling(
      lister,
      syncItem,
    ).execute(INPUT)

    expect(execute).not.toHaveBeenCalled()
    expect(result).toEqual({ items: 0, subscribed: 0, failed: 0 })
  })
})
