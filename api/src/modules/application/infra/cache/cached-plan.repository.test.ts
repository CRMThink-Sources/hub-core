import type IORedis from 'ioredis'
import { describe, expect, it, vi } from 'vitest'
import { CachedPlanRepository } from './cached-plan.repository'
import { Plan } from '@/modules/application/domain/entities/plan'
import { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const plan: Plan = {
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
}

const PLAN_KEY = 'payments:plan:v2:7'
const PLAN_LIST_KEY = 'payments:plans:v2:all'

function makeInner() {
  const getPlan = vi.fn(() => Promise.resolve(plan))
  const getPlans = vi.fn(() => Promise.resolve([plan]))

  const repository: PlanRepository = { getPlan, getPlans }

  return { repository, getPlan, getPlans }
}

/** Redis que devolve `hit` na leitura e aceita a escrita. */
function makeRedis(hit: string | null = null) {
  const get = vi.fn(() => Promise.resolve(hit))
  const set = vi.fn(() => Promise.resolve('OK'))

  return { redis: { get, set } as unknown as IORedis, get, set }
}

function makeFailingRedis(on: 'get' | 'set') {
  const failure = () => Promise.reject(new Error('redis down'))
  const get = vi.fn(on === 'get' ? failure : () => Promise.resolve(null))
  const set = vi.fn(on === 'set' ? failure : () => Promise.resolve('OK'))

  return { redis: { get, set } as unknown as IORedis, get, set }
}

describe('CachedPlanRepository', () => {
  describe('getPlan', () => {
    it('devolve a entrada cacheada sem consultar o repositório interno', async () => {
      const inner = makeInner()
      const { redis } = makeRedis(JSON.stringify(plan))

      const result = await new CachedPlanRepository(
        inner.repository,
        redis,
      ).getPlan('7')

      expect(result).toEqual(plan)
      expect(inner.getPlan).not.toHaveBeenCalled()
    })

    it('em miss consulta o interno e grava com TTL', async () => {
      const inner = makeInner()
      const { redis, set } = makeRedis()

      const result = await new CachedPlanRepository(
        inner.repository,
        redis,
      ).getPlan('7')

      expect(result).toEqual(plan)
      expect(inner.getPlan).toHaveBeenCalledWith('7')
      expect(set).toHaveBeenCalledWith(
        PLAN_KEY,
        JSON.stringify(plan),
        'EX',
        300,
      )
    })

    it('trata falha de leitura do Redis como miss', async () => {
      const inner = makeInner()
      const { redis } = makeFailingRedis('get')

      const result = await new CachedPlanRepository(
        inner.repository,
        redis,
      ).getPlan('7')

      expect(result).toEqual(plan)
      expect(inner.getPlan).toHaveBeenCalled()
    })

    it('descarta entrada com JSON corrompido', async () => {
      const inner = makeInner()
      const { redis } = makeRedis('{not json')

      const result = await new CachedPlanRepository(
        inner.repository,
        redis,
      ).getPlan('7')

      expect(result).toEqual(plan)
      expect(inner.getPlan).toHaveBeenCalled()
    })

    it('descarta entrada com shape desatualizado', async () => {
      const inner = makeInner()
      // Gravada por um deploy que ainda usava o intervalo antigo 'year'.
      const { redis } = makeRedis(JSON.stringify({ ...plan, interval: 'year' }))

      const result = await new CachedPlanRepository(
        inner.repository,
        redis,
      ).getPlan('7')

      expect(result).toEqual(plan)
      expect(inner.getPlan).toHaveBeenCalled()
    })

    it('devolve o valor ao chamador mesmo quando a escrita falha', async () => {
      const inner = makeInner()
      const { redis } = makeFailingRedis('set')

      const result = await new CachedPlanRepository(
        inner.repository,
        redis,
      ).getPlan('7')

      expect(result).toEqual(plan)
    })
  })

  describe('getPlans', () => {
    it('devolve a lista cacheada sem consultar o interno', async () => {
      const inner = makeInner()
      const { redis } = makeRedis(JSON.stringify([plan]))

      const result = await new CachedPlanRepository(
        inner.repository,
        redis,
      ).getPlans()

      expect(result).toEqual([plan])
      expect(inner.getPlans).not.toHaveBeenCalled()
    })

    it('em miss consulta o interno e grava a lista com TTL', async () => {
      const inner = makeInner()
      const { redis, set } = makeRedis()

      const result = await new CachedPlanRepository(
        inner.repository,
        redis,
      ).getPlans()

      expect(result).toEqual([plan])
      expect(set).toHaveBeenCalledWith(
        PLAN_LIST_KEY,
        JSON.stringify([plan]),
        'EX',
        300,
      )
    })
  })
})
