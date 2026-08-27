import type IORedis from 'ioredis'
import { describe, expect, it, vi } from 'vitest'
import { CachedGatewaySubscriptionReader } from './cached-gateway-subscription.reader'
import { gatewaySubscriptionKey } from './keys'
import { GatewaySubscription } from '@/modules/application/domain/entities/gateway-subscription'
import { GatewaySubscriptionReader } from '@/modules/application/domain/repositories/gateway-subscription.reader'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const SUBSCRIPTION_ID = 'sub_abc'
const KEY = gatewaySubscriptionKey(SUBSCRIPTION_ID)

const subscription: GatewaySubscription = {
  status: 'active',
  currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
  items: [
    { priceId: 'price_web', quantity: 2 },
    { priceId: 'price_business', quantity: 1 },
  ],
}

function makeInner() {
  const readSubscription = vi.fn(() => Promise.resolve(subscription))
  const reader: GatewaySubscriptionReader = { readSubscription }

  return { reader, readSubscription }
}

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

describe('CachedGatewaySubscriptionReader', () => {
  it('miss lê do gateway e grava com TTL', async () => {
    const { reader, readSubscription } = makeInner()
    const { redis, set } = makeRedis(null)

    const result = await new CachedGatewaySubscriptionReader(
      reader,
      redis,
    ).readSubscription(SUBSCRIPTION_ID)

    expect(result).toEqual(subscription)
    expect(readSubscription).toHaveBeenCalledWith(SUBSCRIPTION_ID)
    expect(set).toHaveBeenCalledWith(
      KEY,
      JSON.stringify(subscription),
      'EX',
      300,
    )
  })

  it('hit devolve o cacheado sem chamar o gateway', async () => {
    const { reader, readSubscription } = makeInner()
    const { redis } = makeRedis(JSON.stringify(subscription))

    const result = await new CachedGatewaySubscriptionReader(
      reader,
      redis,
    ).readSubscription(SUBSCRIPTION_ID)

    expect(result).toEqual(subscription)
    expect(readSubscription).not.toHaveBeenCalled()
  })

  it('entrada com shape velho vira miss', async () => {
    // `quantity` como string é o shape que uma versão anterior poderia ter gravado.
    // Aceitá-la alimentaria a derivação de bonificado com um valor não numérico.
    const { reader, readSubscription } = makeInner()
    const { redis } = makeRedis(
      JSON.stringify({
        ...subscription,
        items: [{ priceId: 'price_web', quantity: '2' }],
      }),
    )

    const result = await new CachedGatewaySubscriptionReader(
      reader,
      redis,
    ).readSubscription(SUBSCRIPTION_ID)

    expect(result).toEqual(subscription)
    expect(readSubscription).toHaveBeenCalledOnce()
  })

  it('entrada corrompida vira miss', async () => {
    const { reader, readSubscription } = makeInner()
    const { redis } = makeRedis('{ nao e json')

    await new CachedGatewaySubscriptionReader(reader, redis).readSubscription(
      SUBSCRIPTION_ID,
    )

    expect(readSubscription).toHaveBeenCalledOnce()
  })

  it('falha de leitura no Redis vira miss, não erro', async () => {
    const { reader, readSubscription } = makeInner()
    const { redis } = makeFailingRedis('get')

    const result = await new CachedGatewaySubscriptionReader(
      reader,
      redis,
    ).readSubscription(SUBSCRIPTION_ID)

    expect(result).toEqual(subscription)
    expect(readSubscription).toHaveBeenCalledOnce()
  })

  it('falha de escrita no Redis não derruba a leitura', async () => {
    const { reader } = makeInner()
    const { redis } = makeFailingRedis('set')

    const result = await new CachedGatewaySubscriptionReader(
      reader,
      redis,
    ).readSubscription(SUBSCRIPTION_ID)

    expect(result).toEqual(subscription)
  })

  it('datas voltam como Date, não string', async () => {
    const { reader } = makeInner()
    const { redis } = makeRedis(JSON.stringify(subscription))

    const result = await new CachedGatewaySubscriptionReader(
      reader,
      redis,
    ).readSubscription(SUBSCRIPTION_ID)

    expect(result.currentPeriodEnd).toBeInstanceOf(Date)
    expect(result.currentPeriodEnd.toISOString()).toBe(
      '2026-09-01T00:00:00.000Z',
    )
  })

  it('invalidate apaga a chave da assinatura', async () => {
    const { reader } = makeInner()
    const { redis, del } = makeRedis()

    await new CachedGatewaySubscriptionReader(reader, redis).invalidate(
      SUBSCRIPTION_ID,
    )

    expect(del).toHaveBeenCalledWith(KEY)
  })

  it('falha de invalidação não propaga', async () => {
    // A escrita no gateway já aconteceu: derrubar aqui transformaria uma linha
    // criada com sucesso em erro na tela.
    const { reader } = makeInner()
    const { redis } = makeFailingRedis('del')

    await expect(
      new CachedGatewaySubscriptionReader(reader, redis).invalidate(
        SUBSCRIPTION_ID,
      ),
    ).resolves.toBeUndefined()
  })

  it('leitura depois de invalidar volta ao gateway', async () => {
    const { reader, readSubscription } = makeInner()
    const get = vi.fn(() => Promise.resolve<string | null>(null))
    const redis = {
      get,
      set: vi.fn(() => Promise.resolve('OK')),
      del: vi.fn(() => Promise.resolve(1)),
    } as unknown as IORedis

    const cached = new CachedGatewaySubscriptionReader(reader, redis)
    await cached.invalidate(SUBSCRIPTION_ID)
    await cached.readSubscription(SUBSCRIPTION_ID)

    expect(readSubscription).toHaveBeenCalledOnce()
  })
})
