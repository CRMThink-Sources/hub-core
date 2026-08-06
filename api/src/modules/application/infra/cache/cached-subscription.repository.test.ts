import type IORedis from 'ioredis'
import { describe, expect, it, vi } from 'vitest'
import { CachedSubscriptionRepository } from './cached-subscription.repository'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const subscription: Subscription = {
  id: '21',
  name: 'ThinkZap Pro — Acme',
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

/** Mesma assinatura, numa instalação que ainda não tem espelho na SPA. */
const withoutSpaId: Subscription = {
  ...subscription,
  aplication: { ...subscription.aplication, spaId: null },
}

const SUBSCRIPTION_KEY = 'payments:subscription:v4:21'
const SUBSCRIPTION_LIST_KEY = 'payments:subscriptions:v4:all'
const APLICATION_LIST_KEY = 'payments:subscriptions:v4:aplication:512'

function makeInner(entity: Subscription = subscription) {
  const getSubscription = vi.fn(() => Promise.resolve(entity))
  const getSubscriptions = vi.fn(() => Promise.resolve([entity]))
  const getSubscriptionsByAplication = vi.fn(() => Promise.resolve([entity]))
  const createSubscription = vi.fn(() => Promise.resolve(entity))
  const updateSubscription = vi.fn(() => Promise.resolve(entity))
  const listSubscriptionsByGatewayId = vi.fn(() => Promise.resolve([entity]))

  const repository: SubscriptionRepository = {
    getSubscription,
    getSubscriptions,
    getSubscriptionsByAplication,
    listSubscriptionsByGatewayId,
    createSubscription,
    updateSubscription,
  }

  return {
    repository,
    getSubscription,
    getSubscriptions,
    getSubscriptionsByAplication,
    listSubscriptionsByGatewayId,
    createSubscription,
    updateSubscription,
  }
}

/** Redis que devolve `hit` na leitura e aceita escrita e invalidação. */
function makeRedis(hit: string | null = null) {
  const get = vi.fn(() => Promise.resolve(hit))
  const set = vi.fn(() => Promise.resolve('OK'))
  const del = vi.fn(() => Promise.resolve(1))

  return { redis: { get, set, del } as unknown as IORedis, get, set, del }
}

function makeFailingRedis(on: 'get' | 'set' | 'del') {
  const failure = () => Promise.reject(new Error('redis down'))
  const get = vi.fn(on === 'get' ? failure : () => Promise.resolve(null))
  const set = vi.fn(on === 'set' ? failure : () => Promise.resolve('OK'))
  const del = vi.fn(on === 'del' ? failure : () => Promise.resolve(1))

  return { redis: { get, set, del } as unknown as IORedis, get, set, del }
}

const createInput = {
  name: subscription.name,
  planId: '7',
  aplicationSpaId: '512',
  status: 'trialing' as const,
  currentPeriodStart: subscription.currentPeriodStart,
  currentPeriodEnd: subscription.currentPeriodEnd,
}

describe('CachedSubscriptionRepository', () => {
  describe('getSubscription', () => {
    it('devolve a entrada cacheada sem consultar o repositório interno', async () => {
      const inner = makeInner()
      const { redis } = makeRedis(JSON.stringify(subscription))

      const result = await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).getSubscription('21')

      expect(result).toEqual(subscription)
      expect(inner.getSubscription).not.toHaveBeenCalled()
    })

    it('reidrata as datas como Date, não como string', async () => {
      const inner = makeInner()
      const { redis } = makeRedis(JSON.stringify(subscription))

      const result = await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).getSubscription('21')

      expect(result.currentPeriodStart).toBeInstanceOf(Date)
      expect(result.currentPeriodEnd).toBeInstanceOf(Date)
    })

    it('em miss consulta o interno e grava com TTL', async () => {
      const inner = makeInner()
      const { redis, set } = makeRedis()

      const result = await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).getSubscription('21')

      expect(result).toEqual(subscription)
      expect(inner.getSubscription).toHaveBeenCalledWith('21')
      expect(set).toHaveBeenCalledWith(
        SUBSCRIPTION_KEY,
        JSON.stringify(subscription),
        'EX',
        300,
      )
    })

    it('trata falha de leitura do Redis como miss', async () => {
      const inner = makeInner()
      const { redis } = makeFailingRedis('get')

      const result = await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).getSubscription('21')

      expect(result).toEqual(subscription)
      expect(inner.getSubscription).toHaveBeenCalled()
    })

    it('descarta entrada com JSON corrompido', async () => {
      const inner = makeInner()
      const { redis } = makeRedis('{not json')

      const result = await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).getSubscription('21')

      expect(result).toEqual(subscription)
      expect(inner.getSubscription).toHaveBeenCalled()
    })

    it('descarta entrada com shape desatualizado', async () => {
      const inner = makeInner()
      // Gravada por um deploy anterior, quando `Subscription` não tinha `plan`.
      const { plan: _plan, ...withoutPlan } = subscription
      const { redis } = makeRedis(JSON.stringify(withoutPlan))

      const result = await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).getSubscription('21')

      expect(result).toEqual(subscription)
      expect(inner.getSubscription).toHaveBeenCalled()
    })

    /**
     * A chave `v4` não alcança entradas `v3`, então na prática o descarte já
     * aconteceu antes do schema. Este teste cobre o caso residual: entrada sem
     * modalidade gravada sob a chave atual não pode virar `Subscription` com o
     * campo `undefined` — o tipo promete sempre resolvido.
     */
    it('descarta entrada gravada antes da modalidade', async () => {
      const inner = makeInner()
      const { modality: _modality, ...beforeModality } = subscription
      const { redis } = makeRedis(JSON.stringify(beforeModality))

      const result = await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).getSubscription('21')

      expect(result).toEqual(subscription)
      expect(inner.getSubscription).toHaveBeenCalled()
    })

    /**
     * A busca de idempotência do webhook não é cacheada: entrada velha faria uma
     * reentrega ver estado antigo e reprocessar.
     */
    it('não cacheia a busca por id de gateway', async () => {
      const inner = makeInner()
      const { redis, get, set } = makeRedis(JSON.stringify(subscription))

      await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).listSubscriptionsByGatewayId('sub_abc')

      expect(inner.listSubscriptionsByGatewayId).toHaveBeenCalledWith('sub_abc')
      expect(get).not.toHaveBeenCalled()
      expect(set).not.toHaveBeenCalled()
    })

    /**
     * O id do gateway identifica um conjunto: instalação cobrada por dois planos
     * tem duas assinaturas irmãs. O decorator repassa a lista inteira — cortar
     * para a primeira aqui esconderia metade do contrato do webhook.
     */
    it('repassa todas as assinaturas do mesmo id de gateway', async () => {
      const sibling = { ...subscription, id: '22' }
      const inner = makeInner()
      inner.listSubscriptionsByGatewayId.mockResolvedValue([
        subscription,
        sibling,
      ])
      const { redis } = makeRedis()

      const result = await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).listSubscriptionsByGatewayId('sub_abc')

      expect(result).toEqual([subscription, sibling])
    })

    it('descarta entrada do shape v1 (cliente como id, sem aplicação)', async () => {
      const inner = makeInner()
      const { aplication: _aplication, ...rest } = subscription
      const v1Entry = { ...rest, customer: '512' }
      const { redis } = makeRedis(JSON.stringify(v1Entry))

      const result = await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).getSubscription('21')

      expect(result).toEqual(subscription)
      expect(inner.getSubscription).toHaveBeenCalled()
    })

    it('reidrata a aplicação com cliente aninhado e datas como Date', async () => {
      const inner = makeInner()
      const { redis } = makeRedis(JSON.stringify(subscription))

      const result = await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).getSubscription('21')

      expect(result.aplication.customer.memberId).toBe('member-1')
      expect(result.aplication.createdAt).toBeInstanceOf(Date)
      expect(result.aplication.updatedAt).toBeInstanceOf(Date)
      // Produto da assinatura e produto do plano voltam separados.
      expect(result.plan.product.id).toBe('42')
    })

    it('aceita entrada de aplicação sem espelho (spaId nulo)', async () => {
      const inner = makeInner(withoutSpaId)
      const { redis } = makeRedis(JSON.stringify(withoutSpaId))

      const result = await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).getSubscription('21')

      expect(result.aplication.spaId).toBeNull()
      expect(inner.getSubscription).not.toHaveBeenCalled()
    })

    it('devolve o valor ao chamador mesmo quando a escrita falha', async () => {
      const inner = makeInner()
      const { redis } = makeFailingRedis('set')

      const result = await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).getSubscription('21')

      expect(result).toEqual(subscription)
    })
  })

  describe('getSubscriptions', () => {
    it('devolve a lista cacheada sem consultar o interno', async () => {
      const inner = makeInner()
      const { redis } = makeRedis(JSON.stringify([subscription]))

      const result = await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).getSubscriptions()

      expect(result).toEqual([subscription])
      expect(inner.getSubscriptions).not.toHaveBeenCalled()
    })

    it('em miss consulta o interno e grava a lista com TTL', async () => {
      const inner = makeInner()
      const { redis, set } = makeRedis()

      await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).getSubscriptions()

      expect(set).toHaveBeenCalledWith(
        SUBSCRIPTION_LIST_KEY,
        JSON.stringify([subscription]),
        'EX',
        300,
      )
    })
  })

  describe('getSubscriptionsByAplication', () => {
    it('usa uma chave própria, independente da listagem global', async () => {
      const inner = makeInner()
      const { redis, get, set } = makeRedis()

      await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).getSubscriptionsByAplication('512')

      expect(get).toHaveBeenCalledWith(APLICATION_LIST_KEY)
      expect(set).toHaveBeenCalledWith(
        APLICATION_LIST_KEY,
        JSON.stringify([subscription]),
        'EX',
        300,
      )
      expect(get).not.toHaveBeenCalledWith(SUBSCRIPTION_LIST_KEY)
    })

    it('serve a lista da aplicação do cache sem consultar o interno', async () => {
      const inner = makeInner()
      const { redis } = makeRedis(JSON.stringify([subscription]))

      const result = await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).getSubscriptionsByAplication('512')

      expect(result).toEqual([subscription])
      expect(inner.getSubscriptionsByAplication).not.toHaveBeenCalled()
    })
  })

  describe('invalidação na escrita', () => {
    it('após criar, apaga as três chaves e regrava a individual', async () => {
      const inner = makeInner()
      const { redis, del, set } = makeRedis()

      const result = await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).createSubscription(createInput)

      expect(result).toEqual(subscription)
      expect(del).toHaveBeenCalledWith(
        SUBSCRIPTION_KEY,
        SUBSCRIPTION_LIST_KEY,
        APLICATION_LIST_KEY,
      )
      expect(set).toHaveBeenCalledWith(
        SUBSCRIPTION_KEY,
        JSON.stringify(subscription),
        'EX',
        300,
      )
    })

    it('após atualizar, invalida a chave da aplicação da entidade, não do patch', async () => {
      const inner = makeInner()
      const { redis, del } = makeRedis()

      // O patch não menciona a aplicação — a chave certa sai da entidade devolvida.
      await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).updateSubscription('21', { status: 'cancelled' })

      expect(del).toHaveBeenCalledWith(
        SUBSCRIPTION_KEY,
        SUBSCRIPTION_LIST_KEY,
        APLICATION_LIST_KEY,
      )
    })

    it('sem espelho na SPA, invalida só a chave individual e a global', async () => {
      const inner = makeInner(withoutSpaId)
      const { redis, del } = makeRedis()

      await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).updateSubscription('21', { status: 'cancelled' })

      expect(del).toHaveBeenCalledWith(SUBSCRIPTION_KEY, SUBSCRIPTION_LIST_KEY)
    })

    it('invalida antes de regravar, para que o set corrija a chave individual', async () => {
      const inner = makeInner()
      const order: string[] = []
      const del = vi.fn(() => {
        order.push('del')
        return Promise.resolve(1)
      })
      const set = vi.fn(() => {
        order.push('set')
        return Promise.resolve('OK')
      })
      const redis = {
        get: vi.fn(() => Promise.resolve(null)),
        set,
        del,
      } as unknown as IORedis

      await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).updateSubscription('21', { status: 'cancelled' })

      expect(order).toEqual(['del', 'set'])
    })

    it('conclui a escrita mesmo quando a invalidação falha', async () => {
      const inner = makeInner()
      const { redis, set } = makeFailingRedis('del')

      const result = await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).updateSubscription('21', { status: 'cancelled' })

      expect(result).toEqual(subscription)
      // O `del` falhou, mas o write-through da chave individual ainda corrige.
      expect(set).toHaveBeenCalled()
    })

    it('conclui a escrita mesmo quando o write-through falha', async () => {
      const inner = makeInner()
      const { redis } = makeFailingRedis('set')

      const result = await new CachedSubscriptionRepository(
        inner.repository,
        redis,
      ).createSubscription(createInput)

      expect(result).toEqual(subscription)
    })
  })
})
