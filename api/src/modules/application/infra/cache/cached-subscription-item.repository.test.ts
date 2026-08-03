import type IORedis from 'ioredis'
import { describe, expect, it, vi } from 'vitest'
import { CachedSubscriptionItemRepository } from './cached-subscription-item.repository'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const item: SubscriptionItem = {
  id: '77',
  name: 'Conector Acme',
  subscription: '4242',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'inst-1',
    zApiInstanceToken: 'tok-1',
  },
  gatewayId: 'si_abc',
}

const ITEM_KEY = 'payments:subscription-item:v3:77'
const ITEM_LIST_KEY = 'payments:subscription-items:v3:all'
const SUBSCRIPTION_LIST_KEY = 'payments:subscription-items:v3:subscription:4242'

function makeInner(entity: SubscriptionItem = item) {
  const getSubscriptionItem = vi.fn(() => Promise.resolve(entity))
  const getSubscriptionItems = vi.fn(() => Promise.resolve([entity]))
  const getSubscriptionItemsBySubscription = vi.fn(() =>
    Promise.resolve([entity]),
  )
  const createSubscriptionItem = vi.fn(() => Promise.resolve(entity))
  const updateSubscriptionItem = vi.fn(() => Promise.resolve(entity))

  const repository: SubscriptionItemRepository = {
    getSubscriptionItem,
    getSubscriptionItems,
    getSubscriptionItemsBySubscription,
    createSubscriptionItem,
    updateSubscriptionItem,
  }

  return {
    repository,
    getSubscriptionItem,
    getSubscriptionItems,
    getSubscriptionItemsBySubscription,
    createSubscriptionItem,
    updateSubscriptionItem,
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
  name: item.name,
  subscription: item.subscription,
  status: 'active' as const,
  metadata: item.metadata,
}

describe('CachedSubscriptionItemRepository', () => {
  describe('getSubscriptionItem', () => {
    it('devolve a entrada cacheada sem consultar o repositório interno', async () => {
      const inner = makeInner()
      const { redis, get } = makeRedis(JSON.stringify(item))

      const result = await new CachedSubscriptionItemRepository(
        inner.repository,
        redis,
      ).getSubscriptionItem('77')

      expect(get).toHaveBeenCalledWith(ITEM_KEY)
      expect(inner.getSubscriptionItem).not.toHaveBeenCalled()
      expect(result).toEqual(item)
    })

    it('no miss lê da fonte e grava com TTL de 300s', async () => {
      const inner = makeInner()
      const { redis, set } = makeRedis(null)

      await new CachedSubscriptionItemRepository(
        inner.repository,
        redis,
      ).getSubscriptionItem('77')

      expect(inner.getSubscriptionItem).toHaveBeenCalledWith('77')
      expect(set).toHaveBeenCalledWith(
        ITEM_KEY,
        JSON.stringify(item),
        'EX',
        300,
      )
    })

    it('segue para a fonte quando o get do Redis lança', async () => {
      const inner = makeInner()
      const { redis } = makeFailingRedis('get')

      const result = await new CachedSubscriptionItemRepository(
        inner.repository,
        redis,
      ).getSubscriptionItem('77')

      expect(inner.getSubscriptionItem).toHaveBeenCalled()
      expect(result).toEqual(item)
    })

    it('trata entrada corrompida como miss', async () => {
      const inner = makeInner()
      const { redis } = makeRedis('{ nao é json')

      await new CachedSubscriptionItemRepository(
        inner.repository,
        redis,
      ).getSubscriptionItem('77')

      expect(inner.getSubscriptionItem).toHaveBeenCalled()
    })

    it('trata metadata com shape antigo como miss', async () => {
      const inner = makeInner()
      // Shape pré-união discriminada: quatro campos achatados, sem `provider`.
      const stale = JSON.stringify({
        ...item,
        metadata: {
          zApiInstanceId: 'inst-1',
          zApiInstanceToken: 'tok-1',
          hubmessageChanelId: '',
          wabaId: '',
        },
      })
      const { redis } = makeRedis(stale)

      await new CachedSubscriptionItemRepository(
        inner.repository,
        redis,
      ).getSubscriptionItem('77')

      expect(inner.getSubscriptionItem).toHaveBeenCalled()
    })
  })

  describe('getSubscriptionItemsBySubscription', () => {
    it('usa chave própria, independente da listagem global', async () => {
      const inner = makeInner()
      const { redis, get, set } = makeRedis(null)

      await new CachedSubscriptionItemRepository(
        inner.repository,
        redis,
      ).getSubscriptionItemsBySubscription('4242')

      expect(get).toHaveBeenCalledWith(SUBSCRIPTION_LIST_KEY)
      expect(get).not.toHaveBeenCalledWith(ITEM_LIST_KEY)
      expect(set).toHaveBeenCalledWith(
        SUBSCRIPTION_LIST_KEY,
        JSON.stringify([item]),
        'EX',
        300,
      )
    })

    it('devolve a listagem cacheada sem consultar a fonte', async () => {
      const inner = makeInner()
      const { redis } = makeRedis(JSON.stringify([item]))

      const result = await new CachedSubscriptionItemRepository(
        inner.repository,
        redis,
      ).getSubscriptionItemsBySubscription('4242')

      expect(inner.getSubscriptionItemsBySubscription).not.toHaveBeenCalled()
      expect(result).toEqual([item])
    })
  })

  describe('escrita', () => {
    it('a criação invalida as três chaves e regrava a individual', async () => {
      const inner = makeInner()
      const { redis, del, set } = makeRedis(null)

      await new CachedSubscriptionItemRepository(
        inner.repository,
        redis,
      ).createSubscriptionItem(createInput)

      expect(del).toHaveBeenCalledWith(
        ITEM_KEY,
        ITEM_LIST_KEY,
        SUBSCRIPTION_LIST_KEY,
      )
      expect(set).toHaveBeenCalledWith(
        ITEM_KEY,
        JSON.stringify(item),
        'EX',
        300,
      )
    })

    /**
     * Write-through é o que faz "atualizar o cache ao salvar" sair de graça: a
     * gravação de settings passa pelo mesmo caminho de qualquer outro campo.
     */
    it('a gravação de settings invalida as três chaves e regrava a individual', async () => {
      const saved = {
        ...item,
        settings: {
          ...DEFAULT_CONNECTOR_SETTINGS,
          widgetOpenChannelEnabled: true,
        },
      }
      const inner = makeInner(saved)
      const { redis, del, set } = makeRedis(JSON.stringify(item))

      const result = await new CachedSubscriptionItemRepository(
        inner.repository,
        redis,
      ).updateSubscriptionItem('77', { settings: saved.settings })

      expect(del).toHaveBeenCalledWith(
        ITEM_KEY,
        ITEM_LIST_KEY,
        SUBSCRIPTION_LIST_KEY,
      )
      expect(set).toHaveBeenCalledWith(
        ITEM_KEY,
        JSON.stringify(saved),
        'EX',
        300,
      )
      expect(result.settings.widgetOpenChannelEnabled).toBe(true)
    })

    it('a chave de listagem vem da entidade devolvida, não do patch', async () => {
      // O patch nem aceita `subscription`: a chave certa só pode sair da entidade.
      const inner = makeInner({ ...item, subscription: '9999' })
      const { redis, del } = makeRedis(null)

      await new CachedSubscriptionItemRepository(
        inner.repository,
        redis,
      ).updateSubscriptionItem('77', { status: 'cancelled' })

      expect(del).toHaveBeenCalledWith(
        ITEM_KEY,
        ITEM_LIST_KEY,
        'payments:subscription-items:v3:subscription:9999',
      )
    })

    it('conclui a escrita mesmo com o del do Redis falhando', async () => {
      const inner = makeInner()
      const { redis, set } = makeFailingRedis('del')

      const result = await new CachedSubscriptionItemRepository(
        inner.repository,
        redis,
      ).updateSubscriptionItem('77', { status: 'cancelled' })

      expect(result).toEqual(item)
      expect(set).toHaveBeenCalled()
    })

    it('conclui a escrita mesmo com o set do Redis falhando', async () => {
      const inner = makeInner()
      const { redis } = makeFailingRedis('set')

      await expect(
        new CachedSubscriptionItemRepository(
          inner.repository,
          redis,
        ).createSubscriptionItem(createInput),
      ).resolves.toEqual(item)
    })
  })
})
