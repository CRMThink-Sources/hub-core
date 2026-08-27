import type IORedis from 'ioredis'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InvalidateSpaCache, SpaParentReader } from './invalidate-spa-cache'
import {
  planKey,
  planListKey,
  subscriptionKey,
  subscriptionListKey,
  subscriptionsByAplicationKey,
} from '@/modules/application/infra/cache/keys'
import { env } from '@/config/env'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const SPA = env.payments.spa

/**
 * Redis falso com keyspace real: o teste afirma **quais chaves sobraram**, que é o
 * contrato que importa — não a sequência de comandos.
 */
const makeRedis = (keyspace: string[] = []) => {
  const remaining = new Set(keyspace)

  const del = vi.fn((...keys: string[]) => {
    let removed = 0
    for (const key of keys) if (remaining.delete(key)) removed++
    return Promise.resolve(removed)
  })

  const scan = vi.fn((cursor: string, _m: string, pattern: string) => {
    const regex = new RegExp(
      `^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`,
    )
    const matching = [...remaining].filter(key => regex.test(key))

    return Promise.resolve(
      cursor === '0'
        ? (['0', matching] as [string, string[]])
        : (['0', []] as [string, string[]]),
    )
  })

  return { redis: { del, scan } as unknown as IORedis, del, scan, remaining }
}

const makeParents = (
  parentId: string | null | Error,
): SpaParentReader & {
  getParentId: ReturnType<typeof vi.fn>
} => ({
  getParentId: vi.fn(() =>
    parentId instanceof Error
      ? Promise.reject(parentId)
      : Promise.resolve(parentId),
  ),
})

/** Keyspace com uma chave de cada família, mais uma de fila para provar que não vaza. */
const FULL_KEYSPACE = [
  'payments:product:v1:3',
  'payments:products:v1:all',
  planKey('5'),
  planListKey(),
  subscriptionKey('42'),
  subscriptionListKey(),
  subscriptionsByAplicationKey('7'),
  subscriptionsByAplicationKey('8'),
  'payments:subscription-item:v5:9',
  'payments:subscription-items:v5:all',
  'payments:subscription-items:v5:subscription:42',
  'bull:thinkzap-inbound:1',
]

describe('InvalidateSpaCache', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('assinatura (1142)', () => {
    it('apaga a chave individual, a listagem geral e a listagem da aplicação dona', async () => {
      const { redis, remaining } = makeRedis(FULL_KEYSPACE)
      const parents = makeParents('7')

      const result = await new InvalidateSpaCache(redis, parents).execute({
        entityTypeId: SPA.subscriptionEntityType,
        itemId: '42',
      })

      expect(result.handled).toBe(true)
      expect(parents.getParentId).toHaveBeenCalledWith({
        entityTypeId: SPA.subscriptionEntityType,
        itemId: '42',
        parentField: 'parentId1060',
      })
      expect(remaining.has(subscriptionKey('42'))).toBe(false)
      expect(remaining.has(subscriptionListKey())).toBe(false)
      expect(remaining.has(subscriptionsByAplicationKey('7'))).toBe(false)
      // Listagem de outra aplicação sobrevive: a leitura do pai existe para isso.
      expect(remaining.has(subscriptionsByAplicationKey('8'))).toBe(true)
    })

    it('não toca nas famílias de plano, produto e item', async () => {
      const { redis, remaining } = makeRedis(FULL_KEYSPACE)

      await new InvalidateSpaCache(redis, makeParents('7')).execute({
        entityTypeId: SPA.subscriptionEntityType,
        itemId: '42',
      })

      expect(remaining.has(planKey('5'))).toBe(true)
      expect(remaining.has('payments:product:v1:3')).toBe(true)
      expect(remaining.has('payments:subscription-item:v5:9')).toBe(true)
      expect(remaining.has('payments:subscription-items:v5:all')).toBe(true)
    })

    it('varre as listagens por aplicação quando o item já não existe', async () => {
      const { redis, remaining } = makeRedis(FULL_KEYSPACE)

      const result = await new InvalidateSpaCache(
        redis,
        makeParents(null),
      ).execute({ entityTypeId: SPA.subscriptionEntityType, itemId: '42' })

      expect(result.handled).toBe(true)
      expect(remaining.has(subscriptionsByAplicationKey('7'))).toBe(false)
      expect(remaining.has(subscriptionsByAplicationKey('8'))).toBe(false)
      // A varredura é só das listagens por pai: entradas por id de outra assinatura ficam.
      expect(remaining.has('payments:subscription-item:v5:9')).toBe(true)
    })

    it('varre quando a leitura do pai no Bitrix falha, e ainda assim reporta sucesso', async () => {
      const { redis, remaining } = makeRedis(FULL_KEYSPACE)

      const result = await new InvalidateSpaCache(
        redis,
        makeParents(new Error('bitrix down')),
      ).execute({ entityTypeId: SPA.subscriptionEntityType, itemId: '42' })

      expect(result.handled).toBe(true)
      expect(remaining.has(subscriptionKey('42'))).toBe(false)
      expect(remaining.has(subscriptionsByAplicationKey('7'))).toBe(false)
    })

    it('no delete não lê o pai e varre as listagens por aplicação', async () => {
      const { redis, remaining } = makeRedis(FULL_KEYSPACE)
      const parents = makeParents('7')

      const result = await new InvalidateSpaCache(redis, parents).execute({
        entityTypeId: SPA.subscriptionEntityType,
        itemId: '42',
        verb: 'DELETE',
      })

      expect(result.handled).toBe(true)
      expect(parents.getParentId).not.toHaveBeenCalled()
      expect(remaining.has(subscriptionKey('42'))).toBe(false)
      expect(remaining.has(subscriptionListKey())).toBe(false)
      expect(remaining.has(subscriptionsByAplicationKey('7'))).toBe(false)
      expect(remaining.has(subscriptionsByAplicationKey('8'))).toBe(false)
    })

    it('no update continua lendo o pai', async () => {
      const { redis } = makeRedis(FULL_KEYSPACE)
      const parents = makeParents('7')

      await new InvalidateSpaCache(redis, parents).execute({
        entityTypeId: SPA.subscriptionEntityType,
        itemId: '42',
        verb: 'UPDATE',
      })

      expect(parents.getParentId).toHaveBeenCalledTimes(1)
    })

    it('não apaga nada quando o evento vem sem id de item', async () => {
      const { redis, del, scan } = makeRedis(FULL_KEYSPACE)

      const result = await new InvalidateSpaCache(
        redis,
        makeParents('7'),
      ).execute({ entityTypeId: SPA.subscriptionEntityType })

      expect(result).toEqual({ handled: true, deletedKeys: 0 })
      expect(del).not.toHaveBeenCalled()
      expect(scan).not.toHaveBeenCalled()
    })
  })

  describe('item de assinatura (1146)', () => {
    it('apaga a chave individual, a listagem geral e a listagem da assinatura dona', async () => {
      const { redis, remaining } = makeRedis(FULL_KEYSPACE)
      const parents = makeParents('42')

      await new InvalidateSpaCache(redis, parents).execute({
        entityTypeId: SPA.subscriptionItemEntityType,
        itemId: '9',
      })

      expect(parents.getParentId).toHaveBeenCalledWith({
        entityTypeId: SPA.subscriptionItemEntityType,
        itemId: '9',
        parentField: 'parentId1142',
      })
      expect(remaining.has('payments:subscription-item:v5:9')).toBe(false)
      expect(remaining.has('payments:subscription-items:v5:all')).toBe(false)
      expect(
        remaining.has('payments:subscription-items:v5:subscription:42'),
      ).toBe(false)
    })

    it('não invalida a família de assinatura — o item não é aninhado nela', async () => {
      const { redis, remaining } = makeRedis(FULL_KEYSPACE)

      await new InvalidateSpaCache(redis, makeParents('42')).execute({
        entityTypeId: SPA.subscriptionItemEntityType,
        itemId: '9',
      })

      expect(remaining.has(subscriptionKey('42'))).toBe(true)
      expect(remaining.has(subscriptionListKey())).toBe(true)
      expect(remaining.has(subscriptionsByAplicationKey('7'))).toBe(true)
    })

    it('varre as listagens por assinatura quando o pai não pode ser lido', async () => {
      const { redis, remaining } = makeRedis(FULL_KEYSPACE)

      await new InvalidateSpaCache(redis, makeParents(null)).execute({
        entityTypeId: SPA.subscriptionItemEntityType,
        itemId: '9',
      })

      expect(
        remaining.has('payments:subscription-items:v5:subscription:42'),
      ).toBe(false)
      expect(remaining.has(subscriptionKey('42'))).toBe(true)
    })

    it('no delete não lê o pai e varre as listagens por assinatura', async () => {
      const { redis, remaining } = makeRedis(FULL_KEYSPACE)
      const parents = makeParents('42')

      await new InvalidateSpaCache(redis, parents).execute({
        entityTypeId: SPA.subscriptionItemEntityType,
        itemId: '9',
        verb: 'DELETE',
      })

      expect(parents.getParentId).not.toHaveBeenCalled()
      expect(remaining.has('payments:subscription-item:v5:9')).toBe(false)
      expect(remaining.has('payments:subscription-items:v5:all')).toBe(false)
      expect(
        remaining.has('payments:subscription-items:v5:subscription:42'),
      ).toBe(false)
      // Continua sem tocar a família de assinatura, mesmo no delete.
      expect(remaining.has(subscriptionKey('42'))).toBe(true)
    })
  })

  describe('plano (1138)', () => {
    it('apaga as chaves do plano e toda a família de assinatura', async () => {
      const { redis, remaining } = makeRedis(FULL_KEYSPACE)

      await new InvalidateSpaCache(redis, makeParents('7')).execute({
        entityTypeId: SPA.planEntityType,
        itemId: '5',
      })

      expect(remaining.has(planKey('5'))).toBe(false)
      expect(remaining.has(planListKey())).toBe(false)
      expect(remaining.has(subscriptionKey('42'))).toBe(false)
      expect(remaining.has(subscriptionListKey())).toBe(false)
      expect(remaining.has(subscriptionsByAplicationKey('7'))).toBe(false)
      expect(remaining.has(subscriptionsByAplicationKey('8'))).toBe(false)
    })

    it('não toca na família de produto nem na de item', async () => {
      const { redis, remaining } = makeRedis(FULL_KEYSPACE)

      await new InvalidateSpaCache(redis, makeParents('7')).execute({
        entityTypeId: SPA.planEntityType,
        itemId: '5',
      })

      expect(remaining.has('payments:product:v1:3')).toBe(true)
      expect(remaining.has('payments:products:v1:all')).toBe(true)
      expect(remaining.has('payments:subscription-item:v5:9')).toBe(true)
    })

    it('não lê o pai no Bitrix — plano não tem listagem por pai', async () => {
      const { redis } = makeRedis(FULL_KEYSPACE)
      const parents = makeParents('7')

      await new InvalidateSpaCache(redis, parents).execute({
        entityTypeId: SPA.planEntityType,
        itemId: '5',
      })

      expect(parents.getParentId).not.toHaveBeenCalled()
    })
  })

  describe('produto (1134)', () => {
    it('apaga as chaves do produto e as famílias de plano e assinatura', async () => {
      const { redis, remaining } = makeRedis(FULL_KEYSPACE)

      await new InvalidateSpaCache(redis, makeParents('7')).execute({
        entityTypeId: SPA.productEntityType,
        itemId: '3',
      })

      expect(remaining.has('payments:product:v1:3')).toBe(false)
      expect(remaining.has('payments:products:v1:all')).toBe(false)
      expect(remaining.has(planKey('5'))).toBe(false)
      expect(remaining.has(planListKey())).toBe(false)
      expect(remaining.has(subscriptionKey('42'))).toBe(false)
      expect(remaining.has(subscriptionListKey())).toBe(false)
    })

    it('não toca na família de item', async () => {
      const { redis, remaining } = makeRedis(FULL_KEYSPACE)

      await new InvalidateSpaCache(redis, makeParents('7')).execute({
        entityTypeId: SPA.productEntityType,
        itemId: '3',
      })

      expect(remaining.has('payments:subscription-item:v5:9')).toBe(true)
      expect(remaining.has('payments:subscription-items:v5:all')).toBe(true)
    })
  })

  describe('aplicação (1060)', () => {
    it('apaga a família de assinatura, onde a aplicação está hidratada', async () => {
      const { redis, remaining } = makeRedis(FULL_KEYSPACE)

      const result = await new InvalidateSpaCache(
        redis,
        makeParents('7'),
      ).execute({ entityTypeId: SPA.aplicationEntityType, itemId: '7' })

      expect(result.handled).toBe(true)
      expect(remaining.has(subscriptionKey('42'))).toBe(false)
      expect(remaining.has(subscriptionListKey())).toBe(false)
      expect(remaining.has(subscriptionsByAplicationKey('7'))).toBe(false)
      expect(remaining.has(planKey('5'))).toBe(true)
      expect(remaining.has('payments:subscription-item:v5:9')).toBe(true)
    })

    it('no delete apaga também a família de item, que alimenta o contexto', async () => {
      const { redis, remaining } = makeRedis(FULL_KEYSPACE)

      const result = await new InvalidateSpaCache(
        redis,
        makeParents('7'),
      ).execute({
        entityTypeId: SPA.aplicationEntityType,
        itemId: '7',
        verb: 'DELETE',
      })

      expect(result.handled).toBe(true)
      expect(remaining.has(subscriptionKey('42'))).toBe(false)
      expect(remaining.has('payments:subscription-item:v5:9')).toBe(false)
      expect(remaining.has('payments:subscription-items:v5:all')).toBe(false)
      expect(
        remaining.has('payments:subscription-items:v5:subscription:42'),
      ).toBe(false)
      // Plano e produto seguem intactos: a aplicação não é aninhada neles.
      expect(remaining.has(planKey('5'))).toBe(true)
      expect(remaining.has('payments:product:v1:3')).toBe(true)
    })
  })

  it('ignora SPA fora do escopo de billing sem apagar nada', async () => {
    const { redis, del, scan } = makeRedis(FULL_KEYSPACE)

    const result = await new InvalidateSpaCache(
      redis,
      makeParents('7'),
    ).execute({
      entityTypeId: 999,
      itemId: '1',
    })

    expect(result).toEqual({ handled: false, deletedKeys: 0 })
    expect(del).not.toHaveBeenCalled()
    expect(scan).not.toHaveBeenCalled()
  })

  it('não deixa a fila BullMQ ser alcançada por nenhuma varredura', async () => {
    const { redis, remaining } = makeRedis(FULL_KEYSPACE)

    await new InvalidateSpaCache(redis, makeParents('7')).execute({
      entityTypeId: SPA.productEntityType,
      itemId: '3',
    })

    expect(remaining.has('bull:thinkzap-inbound:1')).toBe(true)
  })

  it('engole falha de Redis e reporta o evento como tratado', async () => {
    const { redis, del } = makeRedis(FULL_KEYSPACE)
    del.mockRejectedValueOnce(new Error('redis down'))

    const result = await new InvalidateSpaCache(
      redis,
      makeParents('7'),
    ).execute({
      entityTypeId: SPA.subscriptionEntityType,
      itemId: '42',
    })

    expect(result).toEqual({ handled: true, deletedKeys: 0 })
  })
})
