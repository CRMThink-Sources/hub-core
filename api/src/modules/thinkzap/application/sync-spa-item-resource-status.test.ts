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
import type { SubscriptionStatusReader } from '@/modules/thinkzap/domain/ports/subscription-status-reader.port'
import { apiLogger } from '@/shared/infra/logger'

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
  const setBillingState = vi.fn(
    (_id: string, state: 'subscribed' | 'unsubscribed') => {
      if (!stored) return Promise.resolve()
      const { subscribedAt: _s, unsubscribedAt: _u, ...rest } = stored
      stored =
        state === 'subscribed'
          ? { ...rest, subscribedAt: '2026-08-13T00:00:00.000Z' }
          : { ...rest, unsubscribedAt: '2026-08-13T00:00:00.000Z' }
      return Promise.resolve()
    },
  )
  const remove = vi.fn(() => {
    stored = null
    return Promise.resolve()
  })

  return {
    mirrors: {
      find,
      save,
      setBillingState,
      remove,
    } as unknown as SpaItemResourceMirrorRepository,
    find,
    save,
    setBillingState,
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

/** Status da assinatura pai, lido cru. Ativa por padrão: é o caso de cobrança normal. */
const makeParents = (
  status: Awaited<
    ReturnType<SubscriptionStatusReader['getSubscriptionStatus']>
  > = 'active',
) => {
  const getSubscriptionStatus = vi.fn(() => Promise.resolve(status))

  return {
    reader: { getSubscriptionStatus } as SubscriptionStatusReader,
    getSubscriptionStatus,
  }
}

describe('SyncSpaItemResourceStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('desassina quando o item foi marcado cancelado e não havia marca', async () => {
    const items = makeItems(rawItem({ status: 'cancelled' }))
    const mirrors = makeMirrors(MIRROR)
    const billing = makeBilling()
    const parents = makeParents()

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
      parents.reader,
    ).execute(INPUT)

    expect(result.outcome).toBe('unsubscribed')
    expect(billing.unsubscribeResource).toHaveBeenCalledWith(
      { provider: 'ZAPI', instanceId: 'inst-1', zApiToken: 'tok-1' },
      { origin: 'spa-item-status', propagate: true },
    )
    expect(mirrors.setBillingState).toHaveBeenCalledWith('77', 'unsubscribed')
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
    const parents = makeParents()

    await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
      parents.reader,
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
    const parents = makeParents()

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
      parents.reader,
    ).execute(INPUT)

    expect(result.outcome).toBe('noop')
    expect(billing.unsubscribeResource).not.toHaveBeenCalled()
    expect(billing.subscribeResource).not.toHaveBeenCalled()
  })

  /**
   * O caso que faltava: linha manual provisionada e nunca assinada. Ativa sob assinatura
   * ativa, sem marca de assinado — assina e marca.
   */
  it('assina item ativo sob assinatura ativa quando não há marca de assinado', async () => {
    const items = makeItems(rawItem())
    const mirrors = makeMirrors(MIRROR)
    const billing = makeBilling()
    const parents = makeParents('active')

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
      parents.reader,
    ).execute(INPUT)

    expect(result.outcome).toBe('subscribed')
    expect(parents.getSubscriptionStatus).toHaveBeenCalledWith('42')
    expect(billing.subscribeResource).toHaveBeenCalledWith(
      { provider: 'ZAPI', instanceId: 'inst-1', zApiToken: 'tok-1' },
      { origin: 'spa-item-status', propagate: true },
    )
    expect(mirrors.setBillingState).toHaveBeenCalledWith('77', 'subscribed')
    expect(mirrors.current()?.subscribedAt).toEqual(expect.any(String))
  })

  it('assina linha HubMessage pelo canal', async () => {
    const items = makeItems(
      rawItem({
        provider: 'HUBMESSAGE',
        credentials: { hubmessageChannelId: 'chan-1' },
      }),
    )
    const mirrors = makeMirrors(null)
    const billing = makeBilling()
    const parents = makeParents('active')

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
      parents.reader,
    ).execute(INPUT)

    expect(result.outcome).toBe('subscribed')
    expect(billing.subscribeResource).toHaveBeenCalledWith(
      { provider: 'HUBMESSAGE', instanceId: 'chan-1', channelId: 'chan-1' },
      expect.anything(),
    )
    // Espelho ausente é gravado antes da marca, para ela ter onde morar.
    expect(mirrors.save).toHaveBeenCalled()
    expect(mirrors.current()?.subscribedAt).toEqual(expect.any(String))
  })

  /**
   * O caminho de toda edição de campo do item — inclusive as escritas da própria API,
   * como `UF_CRM_93_CONNECTED`. Sem a marca, cada uma assinaria de novo.
   */
  it('não chama o provider nem lê o pai em item ativo já marcado como assinado', async () => {
    const items = makeItems(rawItem())
    const mirrors = makeMirrors({
      ...MIRROR,
      subscribedAt: '2026-08-01T00:00:00.000Z',
    })
    const billing = makeBilling()
    const parents = makeParents('active')

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
      parents.reader,
    ).execute(INPUT)

    expect(result.outcome).toBe('noop')
    expect(parents.getSubscriptionStatus).not.toHaveBeenCalled()
    expect(billing.subscribeResource).not.toHaveBeenCalled()
    expect(billing.unsubscribeResource).not.toHaveBeenCalled()
  })

  it.each(['trialing', 'trial_expired'] as const)(
    'nunca assina sob assinatura %s',
    async status => {
      const items = makeItems(rawItem())
      const mirrors = makeMirrors(MIRROR)
      const billing = makeBilling()
      const parents = makeParents(status)

      const result = await new SyncSpaItemResourceStatus(
        items.items,
        mirrors.mirrors,
        billing.billing,
        parents.reader,
      ).execute(INPUT)

      expect(result.outcome).toBe('noop')
      expect(billing.subscribeResource).not.toHaveBeenCalled()
      expect(mirrors.setBillingState).not.toHaveBeenCalled()
    },
  )

  /** Sob assinatura cancelada a linha é desassinada — ver `assinatura pai cancelada`. */
  it('não assina nem desassina sob assinatura past_due', async () => {
    const items = makeItems(rawItem())
    const mirrors = makeMirrors(MIRROR)
    const billing = makeBilling()
    const parents = makeParents('past_due')

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
      parents.reader,
    ).execute(INPUT)

    expect(result.outcome).toBe('noop')
    expect(billing.subscribeResource).not.toHaveBeenCalled()
    expect(billing.unsubscribeResource).not.toHaveBeenCalled()
  })

  it('reassina quando o item volta a ativo sob assinatura ativa', async () => {
    const items = makeItems(rawItem())
    const mirrors = makeMirrors({
      ...MIRROR,
      unsubscribedAt: '2026-08-01T00:00:00.000Z',
    })
    const billing = makeBilling()
    const parents = makeParents('active')

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
      parents.reader,
    ).execute(INPUT)

    expect(result.outcome).toBe('subscribed')
    expect(mirrors.setBillingState).toHaveBeenCalledWith('77', 'subscribed')
    expect(mirrors.current()?.unsubscribedAt).toBeUndefined()
  })

  /**
   * Mudança de comportamento: antes, a reassinatura não olhava o contrato, e nós
   * pagávamos ao provider pela linha de quem saiu.
   */
  it('não reassina item devolvido a ativo sob assinatura cancelada', async () => {
    const items = makeItems(rawItem())
    const mirrors = makeMirrors({
      ...MIRROR,
      unsubscribedAt: '2026-08-01T00:00:00.000Z',
    })
    const billing = makeBilling()
    const parents = makeParents('cancelled')

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
      parents.reader,
    ).execute(INPUT)

    expect(result.outcome).toBe('noop')
    expect(billing.subscribeResource).not.toHaveBeenCalled()
  })

  describe('assinatura pai cancelada', () => {
    it('desassina linha assinada com o status vindo do fan-out, sem reler o pai', async () => {
      const items = makeItems(rawItem())
      const mirrors = makeMirrors({
        ...MIRROR,
        subscribedAt: '2026-08-01T00:00:00.000Z',
      })
      const billing = makeBilling()
      const parents = makeParents('active')

      const result = await new SyncSpaItemResourceStatus(
        items.items,
        mirrors.mirrors,
        billing.billing,
        parents.reader,
      ).execute({ ...INPUT, parentStatus: 'cancelled' })

      expect(result.outcome).toBe('unsubscribed')
      expect(parents.getSubscriptionStatus).not.toHaveBeenCalled()
      expect(billing.unsubscribeResource).toHaveBeenCalledWith(
        { provider: 'ZAPI', instanceId: 'inst-1', zApiToken: 'tok-1' },
        { origin: 'subscription-cancelled', propagate: true },
      )
      expect(mirrors.setBillingState).toHaveBeenCalledWith('77', 'unsubscribed')
      expect(mirrors.current()?.subscribedAt).toBeUndefined()
      expect(mirrors.current()?.unsubscribedAt).toBeDefined()
    })

    /** O UPDATE do item não ganha ida extra ao Bitrix: quem desassina é o fan-out. */
    it('sem o status do fan-out, não lê o pai de linha já assinada', async () => {
      const items = makeItems(rawItem())
      const mirrors = makeMirrors({
        ...MIRROR,
        subscribedAt: '2026-08-01T00:00:00.000Z',
      })
      const billing = makeBilling()
      const parents = makeParents('cancelled')

      const result = await new SyncSpaItemResourceStatus(
        items.items,
        mirrors.mirrors,
        billing.billing,
        parents.reader,
      ).execute(INPUT)

      expect(result.outcome).toBe('noop')
      expect(parents.getSubscriptionStatus).not.toHaveBeenCalled()
      expect(billing.unsubscribeResource).not.toHaveBeenCalled()
    })

    it('sem o status do fan-out, desassina linha ativa sem marca sob pai lido como cancelado', async () => {
      const items = makeItems(rawItem())
      const mirrors = makeMirrors(MIRROR)
      const billing = makeBilling()
      const parents = makeParents('cancelled')

      const result = await new SyncSpaItemResourceStatus(
        items.items,
        mirrors.mirrors,
        billing.billing,
        parents.reader,
      ).execute(INPUT)

      expect(result.outcome).toBe('unsubscribed')
      expect(parents.getSubscriptionStatus).toHaveBeenCalledWith('42')
      expect(billing.unsubscribeResource).toHaveBeenCalledWith(
        expect.anything(),
        { origin: 'subscription-cancelled', propagate: true },
      )
    })

    it('não grava a marca quando a desassinatura falha, e propaga', async () => {
      const items = makeItems(rawItem())
      const mirrors = makeMirrors({
        ...MIRROR,
        subscribedAt: '2026-08-01T00:00:00.000Z',
      })
      const billing = makeBilling({ failing: true })

      await expect(
        new SyncSpaItemResourceStatus(
          items.items,
          mirrors.mirrors,
          billing.billing,
          makeParents().reader,
        ).execute({ ...INPUT, parentStatus: 'cancelled' }),
      ).rejects.toThrow('provider fora')

      expect(mirrors.setBillingState).not.toHaveBeenCalled()
      expect(mirrors.current()?.subscribedAt).toBeDefined()
    })
  })

  it('não assina item ativo sem assinatura pai, e registra warn', async () => {
    const items = makeItems(rawItem({ subscriptionId: null }))
    const mirrors = makeMirrors(null)
    const billing = makeBilling()
    const parents = makeParents('active')

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
      parents.reader,
    ).execute(INPUT)

    expect(result.outcome).toBe('noop')
    expect(parents.getSubscriptionStatus).not.toHaveBeenCalled()
    expect(billing.subscribeResource).not.toHaveBeenCalled()
    expect(apiLogger.warn).toHaveBeenCalled()
  })

  it('não lê o pai para desassinar — linha cancelada sai sob qualquer contrato', async () => {
    const items = makeItems(rawItem({ status: 'cancelled' }))
    const mirrors = makeMirrors({
      ...MIRROR,
      subscribedAt: '2026-08-01T00:00:00.000Z',
    })
    const billing = makeBilling()
    const parents = makeParents('active')

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
      parents.reader,
    ).execute(INPUT)

    expect(result.outcome).toBe('unsubscribed')
    expect(parents.getSubscriptionStatus).not.toHaveBeenCalled()
    expect(mirrors.current()?.subscribedAt).toBeUndefined()
  })

  it('grava o espelho ausente ao desassinar, para a marca ter onde morar', async () => {
    const items = makeItems(rawItem({ status: 'cancelled' }))
    const mirrors = makeMirrors(null)
    const billing = makeBilling()
    const parents = makeParents()

    await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
      parents.reader,
    ).execute(INPUT)

    expect(mirrors.save).toHaveBeenCalledWith('77', {
      provider: 'ZAPI',
      instanceId: 'inst-1',
      zApiToken: 'tok-1',
      subscriptionId: '42',
    })
    expect(mirrors.setBillingState).toHaveBeenCalledWith('77', 'unsubscribed')
  })

  it('desassina sem espelhar quando o item não tem assinatura pai', async () => {
    const items = makeItems(
      rawItem({ status: 'cancelled', subscriptionId: null }),
    )
    const mirrors = makeMirrors(null)
    const billing = makeBilling()
    const parents = makeParents()

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
      parents.reader,
    ).execute(INPUT)

    expect(result.outcome).toBe('unsubscribed')
    expect(billing.unsubscribeResource).toHaveBeenCalled()
    expect(mirrors.save).not.toHaveBeenCalled()
  })

  it('não faz nada quando o item já não existe — a exclusão tem caminho próprio', async () => {
    const items = makeItems(null)
    const mirrors = makeMirrors(MIRROR)
    const billing = makeBilling()
    const parents = makeParents()

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
      parents.reader,
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
    const parents = makeParents()

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
      parents.reader,
    ).execute(INPUT)

    expect(result.outcome).toBe('no-credential')
    expect(billing.unsubscribeResource).not.toHaveBeenCalled()
  })

  it('não faz nada quando o id do enum de status não é reconhecido', async () => {
    const items = makeItems(rawItem({ status: null }))
    const mirrors = makeMirrors(MIRROR)
    const billing = makeBilling()
    const parents = makeParents()

    const result = await new SyncSpaItemResourceStatus(
      items.items,
      mirrors.mirrors,
      billing.billing,
      parents.reader,
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
    const parents = makeParents()

    await expect(
      new SyncSpaItemResourceStatus(
        items.items,
        mirrors.mirrors,
        billing.billing,
        parents.reader,
      ).execute(INPUT),
    ).rejects.toThrow('provider fora')

    expect(mirrors.setBillingState).not.toHaveBeenCalled()
    expect(mirrors.current()?.unsubscribedAt).toBeUndefined()
  })

  it('não grava a marca quando a assinatura falha', async () => {
    const items = makeItems(rawItem())
    const mirrors = makeMirrors({
      ...MIRROR,
      unsubscribedAt: '2026-08-01T00:00:00.000Z',
    })
    const billing = makeBilling({ failing: true })
    const parents = makeParents()

    await expect(
      new SyncSpaItemResourceStatus(
        items.items,
        mirrors.mirrors,
        billing.billing,
        parents.reader,
      ).execute(INPUT),
    ).rejects.toThrow('provider fora')

    expect(mirrors.setBillingState).not.toHaveBeenCalled()
    expect(mirrors.current()?.unsubscribedAt).toBe('2026-08-01T00:00:00.000Z')
  })
})

describe('SyncSpaItemResourceStatus — verificação de assinaturas', () => {
  beforeEach(() => vi.clearAllMocks())

  const build = (args: {
    item?: RawSubscriptionItem
    mirror?: SpaItemResourceMirror | null
    subscribeOutcome?: 'subscribed' | 'already-subscribed'
  }) => {
    const items = makeItems(args.item ?? rawItem())
    const mirrors = makeMirrors(
      args.mirror === undefined ? MIRROR : args.mirror,
    )
    const billing = makeBilling()
    billing.subscribeResource.mockImplementation((() =>
      Promise.resolve(args.subscribeOutcome ?? 'subscribed')) as never)
    const parents = makeParents()
    return {
      useCase: new SyncSpaItemResourceStatus(
        items.items,
        mirrors.mirrors,
        billing.billing,
        parents.reader,
      ),
      mirrors,
      billing,
    }
  }

  it('quinto dia de vencimento desassina linha assinada, com a origem própria', async () => {
    const { useCase, billing, mirrors } = build({
      mirror: { ...MIRROR, subscribedAt: '2026-10-01T00:00:00.000Z' },
    })

    const result = await useCase.execute({
      ...INPUT,
      parentStatus: 'past_due',
      mode: 'past-due-expired',
    })

    expect(result.outcome).toBe('unsubscribed')
    expect(billing.unsubscribeResource).toHaveBeenCalledWith(
      { provider: 'ZAPI', instanceId: 'inst-1', zApiToken: 'tok-1' },
      { origin: 'subscription-past-due', propagate: true },
    )
    expect(mirrors.current()?.unsubscribedAt).toBeDefined()
  })

  it('não desassina de novo a linha que já tem a marca', async () => {
    const { useCase, billing } = build({
      mirror: { ...MIRROR, unsubscribedAt: '2026-11-08T00:00:00.000Z' },
    })

    const result = await useCase.execute({
      ...INPUT,
      parentStatus: 'past_due',
      mode: 'past-due-expired',
    })

    expect(result.outcome).toBe('noop')
    expect(billing.unsubscribeResource).not.toHaveBeenCalled()
  })

  it('reconciliação assina mesmo com a marca de assinado e registra "subscribed"', async () => {
    const { useCase, billing } = build({
      mirror: { ...MIRROR, subscribedAt: '2026-10-01T00:00:00.000Z' },
    })

    const result = await useCase.execute({
      ...INPUT,
      parentStatus: 'active',
      mode: 'reconcile',
    })

    expect(result.outcome).toBe('subscribed')
    expect(billing.subscribeResource).toHaveBeenCalledTimes(1)
  })

  it('reconciliação de linha já paga devolve "already-subscribed" e garante a marca', async () => {
    const { useCase, mirrors } = build({
      mirror: MIRROR,
      subscribeOutcome: 'already-subscribed',
    })

    const result = await useCase.execute({
      ...INPUT,
      parentStatus: 'active',
      mode: 'reconcile',
    })

    expect(result.outcome).toBe('already-subscribed')
    expect(mirrors.current()?.subscribedAt).toBeDefined()
  })
})
