import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SyncSpaItemResourceStatus } from './sync-spa-item-resource-status'
import { ProviderResourceBilling } from './provider-resource-billing'
import {
  SpaItemResourceMirror,
  SpaItemResourceMirrorRepository,
} from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import {
  RawSubscriptionItem,
  RawSubscriptionItemReader,
} from '@/modules/thinkzap/domain/ports/raw-subscription-item-reader.port'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const INPUT = { itemId: '77', traceKey: 'spa-item-77' }

const rawItem = (
  overrides: Partial<RawSubscriptionItem> = {},
): RawSubscriptionItem => ({
  id: '77',
  provider: 'ZAPI',
  credentials: { zApiInstanceId: 'inst-1', zApiInstanceToken: 'tok-1' },
  subscriptionId: '42',
  status: 'active',
  ...overrides,
})

const MIRROR: SpaItemResourceMirror = {
  provider: 'ZAPI',
  instanceId: 'inst-1',
  zApiToken: 'tok-1',
  subscriptionId: '42',
}

const makeItems = (item: RawSubscriptionItem | null) => {
  const getRawSubscriptionItem = vi.fn(() => Promise.resolve(item))

  return {
    items: { getRawSubscriptionItem } as unknown as RawSubscriptionItemReader,
    getRawSubscriptionItem,
  }
}

/** Espelho com keyspace real: o teste afirma o valor que sobrou, não a sequência. */
const makeMirrors = (seed: SpaItemResourceMirror | null = null) => {
  let stored = seed

  const find = vi.fn(() => Promise.resolve(stored))
  const save = vi.fn((_id: string, mirror: SpaItemResourceMirror) => {
    stored = mirror
    return Promise.resolve()
  })
  const setUnsubscribed = vi.fn((_id: string, unsubscribed: boolean) => {
    if (!stored) return Promise.resolve()
    stored = unsubscribed
      ? { ...stored, unsubscribedAt: '2026-08-13T00:00:00.000Z' }
      : { ...stored, unsubscribedAt: undefined }
    return Promise.resolve()
  })
  const remove = vi.fn(() => {
    stored = null
    return Promise.resolve()
  })

  return {
    mirrors: {
      find,
      save,
      setUnsubscribed,
      remove,
    } as unknown as SpaItemResourceMirrorRepository,
    find,
    save,
    setUnsubscribed,
    remove,
    current: () => stored,
  }
}

const makeBilling = (options: { failing?: boolean } = {}) => {
  const failure = () => Promise.reject(new Error('provider fora'))

  const subscribeResource = vi.fn(
    options.failing ? failure : () => Promise.resolve(),
  )
  const unsubscribeResource = vi.fn(
    options.failing ? failure : () => Promise.resolve(),
  )
  const subscribe = vi.fn(() => Promise.resolve())
  const unsubscribe = vi.fn(() => Promise.resolve())

  return {
    billing: {
      subscribeResource,
      unsubscribeResource,
      subscribe,
      unsubscribe,
    } as unknown as ProviderResourceBilling,
    subscribeResource,
    unsubscribeResource,
  }
}

describe('SyncSpaItemResourceStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('desassina quando o item foi marcado cancelado e não havia marca', async () => {
    const items = makeItems(rawItem({ status: 'cancelled' }))
    const mirrors = makeMirrors(MIRROR)
    const billing = makeBilling()

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
    ).execute(INPUT)

    expect(result.outcome).toBe('unsubscribed')
    expect(billing.unsubscribeResource).toHaveBeenCalledWith(
      { provider: 'ZAPI', instanceId: 'inst-1', zApiToken: 'tok-1' },
      { origin: 'spa-item-status', propagate: true },
    )
    expect(mirrors.setUnsubscribed).toHaveBeenCalledWith('77', true)
  })

  it('desassina linha HubMessage pelo canal', async () => {
    const items = makeItems(
      rawItem({
        provider: 'HUBMESSAGE',
        credentials: { hubmessageChannelId: 'chan-1' },
        status: 'cancelled',
      }),
    )
    const mirrors = makeMirrors({
      provider: 'HUBMESSAGE',
      instanceId: 'chan-1',
      channelId: 'chan-1',
      subscriptionId: '42',
    })
    const billing = makeBilling()

    await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
    ).execute(INPUT)

    expect(billing.unsubscribeResource).toHaveBeenCalledWith(
      { provider: 'HUBMESSAGE', instanceId: 'chan-1', channelId: 'chan-1' },
      expect.anything(),
    )
  })

  it('não chama o provider na segunda atualização do item já cancelado', async () => {
    const items = makeItems(rawItem({ status: 'cancelled' }))
    const mirrors = makeMirrors({
      ...MIRROR,
      unsubscribedAt: '2026-08-01T00:00:00.000Z',
    })
    const billing = makeBilling()

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
    ).execute(INPUT)

    expect(result.outcome).toBe('noop')
    expect(billing.unsubscribeResource).not.toHaveBeenCalled()
    expect(billing.subscribeResource).not.toHaveBeenCalled()
  })

  it('não chama o provider em item ativo sem marca — o caminho de toda edição de campo', async () => {
    const items = makeItems(rawItem())
    const mirrors = makeMirrors(MIRROR)
    const billing = makeBilling()

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
    ).execute(INPUT)

    expect(result.outcome).toBe('noop')
    expect(billing.unsubscribeResource).not.toHaveBeenCalled()
    expect(billing.subscribeResource).not.toHaveBeenCalled()
  })

  it('reassina quando o item volta a ativo e havia marca', async () => {
    const items = makeItems(rawItem())
    const mirrors = makeMirrors({
      ...MIRROR,
      unsubscribedAt: '2026-08-01T00:00:00.000Z',
    })
    const billing = makeBilling()

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
    ).execute(INPUT)

    expect(result.outcome).toBe('resubscribed')
    expect(billing.subscribeResource).toHaveBeenCalledWith(
      { provider: 'ZAPI', instanceId: 'inst-1', zApiToken: 'tok-1' },
      { origin: 'spa-item-status', propagate: true },
    )
    expect(mirrors.setUnsubscribed).toHaveBeenCalledWith('77', false)
  })

  it('grava o espelho ausente ao desassinar, para a marca ter onde morar', async () => {
    const items = makeItems(rawItem({ status: 'cancelled' }))
    const mirrors = makeMirrors(null)
    const billing = makeBilling()

    await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
    ).execute(INPUT)

    expect(mirrors.save).toHaveBeenCalledWith('77', {
      provider: 'ZAPI',
      instanceId: 'inst-1',
      zApiToken: 'tok-1',
      subscriptionId: '42',
    })
    expect(mirrors.setUnsubscribed).toHaveBeenCalledWith('77', true)
  })

  it('desassina sem espelhar quando o item não tem assinatura pai', async () => {
    const items = makeItems(rawItem({ status: 'cancelled', subscriptionId: null }))
    const mirrors = makeMirrors(null)
    const billing = makeBilling()

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
    ).execute(INPUT)

    expect(result.outcome).toBe('unsubscribed')
    expect(billing.unsubscribeResource).toHaveBeenCalled()
    expect(mirrors.save).not.toHaveBeenCalled()
  })

  it('não faz nada quando o item já não existe — a exclusão tem caminho próprio', async () => {
    const items = makeItems(null)
    const mirrors = makeMirrors(MIRROR)
    const billing = makeBilling()

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
    ).execute(INPUT)

    expect(result.outcome).toBe('item-missing')
    expect(billing.unsubscribeResource).not.toHaveBeenCalled()
    expect(mirrors.remove).not.toHaveBeenCalled()
  })

  it('não faz nada em item sem credencial de provider', async () => {
    const items = makeItems(
      rawItem({ provider: 'NONE', credentials: {}, status: 'cancelled' }),
    )
    const mirrors = makeMirrors(null)
    const billing = makeBilling()

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
    ).execute(INPUT)

    expect(result.outcome).toBe('no-credential')
    expect(billing.unsubscribeResource).not.toHaveBeenCalled()
  })

  it('não faz nada quando o id do enum de status não é reconhecido', async () => {
    const items = makeItems(rawItem({ status: null }))
    const mirrors = makeMirrors(MIRROR)
    const billing = makeBilling()

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
    ).execute(INPUT)

    expect(result.outcome).toBe('unknown-status')
    expect(billing.unsubscribeResource).not.toHaveBeenCalled()
  })

  /**
   * A garantia que sustenta a idempotência inteira: marca gravada sem desassinatura
   * esconderia para sempre um recurso que continua sendo cobrado de nós.
   */
  it('não grava a marca quando a desassinatura falha, e propaga para a fila retentar', async () => {
    const items = makeItems(rawItem({ status: 'cancelled' }))
    const mirrors = makeMirrors(MIRROR)
    const billing = makeBilling({ failing: true })

    await expect(
      new SyncSpaItemResourceStatus(
        items.items,
        mirrors.mirrors,
        billing.billing,
      ).execute(INPUT),
    ).rejects.toThrow('provider fora')

    expect(mirrors.setUnsubscribed).not.toHaveBeenCalled()
    expect(mirrors.current()?.unsubscribedAt).toBeUndefined()
  })

  it('não limpa a marca quando a reassinatura falha', async () => {
    const items = makeItems(rawItem())
    const mirrors = makeMirrors({
      ...MIRROR,
      unsubscribedAt: '2026-08-01T00:00:00.000Z',
    })
    const billing = makeBilling({ failing: true })

    await expect(
      new SyncSpaItemResourceStatus(
        items.items,
        mirrors.mirrors,
        billing.billing,
      ).execute(INPUT),
    ).rejects.toThrow('provider fora')

    expect(mirrors.setUnsubscribed).not.toHaveBeenCalled()
    expect(mirrors.current()?.unsubscribedAt).toBe('2026-08-01T00:00:00.000Z')
  })
})
