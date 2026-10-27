import type IORedis from 'ioredis'
import { describe, expect, it, vi } from 'vitest'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import type { Aplication } from '@/modules/application/domain/entities/aplication'
import type { Subscription } from '@/modules/application/domain/entities/subscription'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { AplicationRepository } from '@/modules/application/domain/repositories/aplication.repository'
import type { CustomerRepository } from '@/modules/application/domain/repositories/customer.repository'
import type { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import type { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import { CachedSubscriptionItemRepository } from '@/modules/application/infra/cache/cached-subscription-item.repository'
import { CachedSubscriptionRepository } from '@/modules/application/infra/cache/cached-subscription.repository'
import { STALE_KEY_PREFIX } from '@/modules/application/infra/cache/keys'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { resolveLineTarget } from './widget-send-line-target'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const aplication: Aplication = {
  id: 'app-1',
  spaId: '512',
  customer: {
    id: 'domain-1',
    name: 'querobombinhas.bitrix24.com.br',
    memberId: 'member-1',
  },
  appCode: 'crmthink.thinkzap',
  title: 'ThinkZap — Quero Bombinhas',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
}

const subscription: Subscription = {
  id: '21',
  name: 'ThinkZap',
  plan: {
    id: '7',
    name: 'ThinkZap Pro',
    product: {
      id: '42',
      name: 'ThinkZap',
      billingModel: 'subscription',
      active: true,
    },
    amount: 4990,
    interval: 'monthly',
    gatewayId: 'price_abc',
    active: true,
  },
  status: 'active',
  currentPeriodStart: new Date('2026-10-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2026-11-01T00:00:00.000Z'),
  aplication,
  gatewayId: 'sub_abc',
  modality: 'stripe',
}

const line: SubscriptionItem = {
  id: '77',
  name: 'Linha 6',
  subscription: '21',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: '6',
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: '3F76EC8FA07B70E73C7D22AA0216E828',
    zApiInstanceToken: 'tok',
  },
}

function memoryRedis() {
  const store = new Map<string, string>()
  const redis = {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, value: string) => {
      store.set(key, value)
      return Promise.resolve('OK')
    }),
    del: vi.fn(() => Promise.resolve(1)),
  } as unknown as IORedis

  /** O TTL de 5 min venceu: só as reservas sobram. */
  const expireFresh = () => {
    for (const key of [...store.keys()]) {
      if (!key.startsWith(STALE_KEY_PREFIX)) store.delete(key)
    }
  }

  return { redis, expireFresh }
}

/** O mesmo caso de uso do worker, com o Bitrix interno dublado e o cache real. */
function makeContext(redis: IORedis) {
  const bitrix = { down: false }
  const fromBitrix = <T>(value: T) =>
    vi.fn(() =>
      bitrix.down
        ? Promise.reject(new Error('Failed to list CRM items'))
        : Promise.resolve(value),
    )

  const customers = {
    getCustomer: vi.fn(() => Promise.resolve(aplication.customer)),
  } as unknown as CustomerRepository
  const aplications = {
    getAplicationByInstall: vi.fn(() => Promise.resolve(aplication)),
  } as unknown as AplicationRepository
  const subscriptions = new CachedSubscriptionRepository(
    {
      getSubscriptionsByAplication: fromBitrix([subscription]),
    } as unknown as SubscriptionRepository,
    redis,
  )
  const items = new CachedSubscriptionItemRepository(
    {
      getSubscriptionItemsBySubscription: fromBitrix([line]),
    } as unknown as SubscriptionItemRepository,
    redis,
  )

  const useCase = new GetAplicationContext(
    customers,
    aplications,
    subscriptions,
    items,
  )

  return {
    bitrix,
    load: (input: { domainId: string; appCode: string }) =>
      useCase.execute(input),
  }
}

const row = {
  id: 'cd9192b3-dc67-4303-a048-b624ab4c59fb',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  subscriptionItemId: '77',
}

describe('resolveLineTarget sobre o contexto cacheado', () => {
  it('Bitrix falha com cópia de reserva disponível: a linha é resolvida na mesma tentativa', async () => {
    const { redis, expireFresh } = memoryRedis()
    const context = makeContext(redis)

    // Um envio anterior leu o Bitrix com sucesso e gravou fresca + reserva.
    await resolveLineTarget(row, context.load)

    expireFresh()
    context.bitrix.down = true

    const resolution = await resolveLineTarget(row, context.load)

    expect(resolution).toMatchObject({
      kind: 'found',
      line: {
        provider: ConnectorProvider.ZAPI,
        instanceId: '3F76EC8FA07B70E73C7D22AA0216E828',
      },
    })
  })

  it('sem reserva, a queda do Bitrix é unavailable — vai para retentativa', async () => {
    const { redis } = memoryRedis()
    const context = makeContext(redis)
    context.bitrix.down = true

    const resolution = await resolveLineTarget(row, context.load)

    expect(resolution.kind).toBe('unavailable')
  })
})
