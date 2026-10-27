import type IORedis from 'ioredis'
import { describe, expect, it, vi } from 'vitest'
import type { Plan } from '@/modules/application/domain/entities/plan'
import type { Product } from '@/modules/application/domain/entities/product'
import type { Subscription } from '@/modules/application/domain/entities/subscription'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'
import type { ProductRepository } from '@/modules/application/domain/repositories/get-product.repository'
import type { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import type { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { CachedPlanRepository } from './cached-plan.repository'
import { CachedProductRepository } from './cached-product.repository'
import { CachedSubscriptionRepository } from './cached-subscription.repository'
import { CachedSubscriptionItemRepository } from './cached-subscription-item.repository'
import { STALE_KEY_PREFIX } from './keys'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

/**
 * Redis em memória, sem TTL: o vencimento do cache fresco é simulado apagando as
 * chaves frescas, e o da reserva apagando as de reserva.
 */
function memoryRedis() {
  const store = new Map<string, string>()
  const set = vi.fn((key: string, value: string) => {
    store.set(key, value)
    return Promise.resolve('OK')
  })
  const redis = {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set,
    del: vi.fn(() => Promise.resolve(1)),
  } as unknown as IORedis

  const expire = (which: 'fresh' | 'stale') => {
    for (const key of [...store.keys()]) {
      if (key.startsWith(STALE_KEY_PREFIX) === (which === 'stale')) {
        store.delete(key)
      }
    }
  }

  return { redis, set, expire }
}

const bitrixDown = new Error('Failed to list CRM items')

/** `fails` liga e desliga a queda do Bitrix sem recriar o repositório. */
function source<T>(value: T) {
  const state = { fails: false }
  const read = vi.fn(() =>
    state.fails ? Promise.reject(bitrixDown) : Promise.resolve(value),
  )
  return { state, read }
}

const product: Product = {
  id: '42',
  name: 'ThinkZap',
  billingModel: 'subscription',
  active: true,
}

const plan: Plan = {
  id: '7',
  name: 'ThinkZap Pro',
  product,
  amount: 4990,
  interval: 'monthly',
  gatewayId: 'price_abc',
  active: true,
}

const subscription: Subscription = {
  id: '21',
  name: 'ThinkZap Pro — Acme',
  plan,
  status: 'active',
  currentPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
  aplication: {
    id: 'app-1',
    spaId: '512',
    customer: {
      id: 'domain-1',
      name: 'acme.bitrix24.com.br',
      memberId: 'member-1',
    },
    appCode: 'thinkerszap',
    title: 'ThinkersZap — Acme',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  },
  gatewayId: 'sub_abc',
  modality: 'stripe',
}

const item: SubscriptionItem = {
  id: '77',
  name: 'Linha 77',
  subscription: '21',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: '6',
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'inst-1',
    zApiInstanceToken: 'tok-1',
  },
}

type Case = {
  name: string
  expected: unknown
  build: (redis: IORedis) => {
    state: { fails: boolean }
    read: () => Promise<unknown>
  }
}

const cases: Case[] = [
  {
    name: 'produto',
    expected: product,
    build: redis => {
      const src = source(product)
      const inner = {
        getProduct: src.read,
        getProducts: vi.fn(),
      } as unknown as ProductRepository
      const repo = new CachedProductRepository(inner, redis)
      return { state: src.state, read: () => repo.getProduct('42') }
    },
  },
  {
    name: 'plano',
    expected: plan,
    build: redis => {
      const src = source(plan)
      const inner = {
        getPlan: src.read,
        getPlans: vi.fn(),
      } as unknown as PlanRepository
      const repo = new CachedPlanRepository(inner, redis)
      return { state: src.state, read: () => repo.getPlan('7') }
    },
  },
  {
    name: 'assinaturas da aplicação',
    expected: [subscription],
    build: redis => {
      const src = source([subscription])
      const inner = {
        getSubscriptionsByAplication: src.read,
      } as unknown as SubscriptionRepository
      const repo = new CachedSubscriptionRepository(inner, redis)
      return {
        state: src.state,
        read: () => repo.getSubscriptionsByAplication('512'),
      }
    },
  },
  {
    name: 'itens da assinatura (linhas)',
    expected: [item],
    build: redis => {
      const src = source([item])
      const inner = {
        getSubscriptionItemsBySubscription: src.read,
      } as unknown as SubscriptionItemRepository
      const repo = new CachedSubscriptionItemRepository(inner, redis)
      return {
        state: src.state,
        read: () => repo.getSubscriptionItemsBySubscription('21'),
      }
    },
  },
]

describe.each(cases)('stale-if-error em $name', ({ expected, build }) => {
  it('Bitrix falha com cópia de reserva disponível: serve a reserva', async () => {
    const { redis, expire } = memoryRedis()
    const sut = build(redis)

    await sut.read() // leitura boa grava fresca + reserva
    expire('fresh')
    sut.state.fails = true

    await expect(sut.read()).resolves.toEqual(expected)
  })

  it('reserva servida não regrava o cache fresco', async () => {
    const { redis, set, expire } = memoryRedis()
    const sut = build(redis)

    await sut.read()
    expire('fresh')
    sut.state.fails = true
    await sut.read()

    // Bitrix voltou: a próxima leitura tem que ir à fonte, não a uma fresca velha.
    sut.state.fails = false
    const writesBefore = set.mock.calls.length
    await sut.read()
    expect(set.mock.calls.length).toBeGreaterThan(writesBefore)
  })

  it('Cópia de reserva vencida: relança a falha do Bitrix', async () => {
    const { redis, expire } = memoryRedis()
    const sut = build(redis)

    await sut.read()
    expire('fresh')
    expire('stale')
    sut.state.fails = true

    await expect(sut.read()).rejects.toBe(bitrixDown)
  })
})
