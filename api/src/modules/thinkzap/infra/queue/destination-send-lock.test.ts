import { beforeEach, describe, expect, it, vi } from 'vitest'
import type IORedis from 'ioredis'
import { acquireDestinationLock } from './destination-send-lock'

/**
 * Redis de mentira com a semântica que importa aqui: `SET NX` só grava se a chave não
 * existe, e o script Lua só apaga se o valor bate. É o suficiente para provar a
 * exclusão mútua e a proteção contra liberar o lock alheio.
 */
function fakeRedis() {
  const store = new Map<string, string>()

  const set = vi.fn(
    (key: string, value: string, _px: string, _ttl: number, nx: string) => {
      if (nx === 'NX' && store.has(key)) return Promise.resolve(null)
      store.set(key, value)
      return Promise.resolve('OK')
    },
  )

  const evalScript = vi.fn(
    (_script: string, _keys: number, key: string, token: string) => {
      if (store.get(key) === token) {
        store.delete(key)
        return Promise.resolve(1)
      }
      return Promise.resolve(0)
    },
  )

  const redis = { set, eval: evalScript }

  return { redis: redis as unknown as IORedis, store, set }
}

describe('acquireDestinationLock', () => {
  beforeEach(() => vi.clearAllMocks())

  it('concede o lock quando o destino está livre', async () => {
    const { redis } = fakeRedis()

    const lock = await acquireDestinationLock(redis, 'inst-1', '5511999999999')

    expect(lock).not.toBeNull()
  })

  /**
   * A garantia de ordem: enquanto o primeiro envio para aquele contato não terminar,
   * nenhum outro começa. Sem isto, duas mensagens seguidas do operador podem ser
   * entregues invertidas e o contato lê a resposta antes da pergunta.
   */
  it('recusa o segundo pedido para o mesmo par (linha, destino)', async () => {
    const { redis } = fakeRedis()

    const first = await acquireDestinationLock(redis, 'inst-1', '5511999999999')
    const second = await acquireDestinationLock(
      redis,
      'inst-1',
      '5511999999999',
    )

    expect(first).not.toBeNull()
    expect(second).toBeNull()
  })

  it('libera o destino para o próximo depois do release', async () => {
    const { redis } = fakeRedis()

    const first = await acquireDestinationLock(redis, 'inst-1', '5511999999999')
    await first?.release()
    const second = await acquireDestinationLock(
      redis,
      'inst-1',
      '5511999999999',
    )

    expect(second).not.toBeNull()
  })

  /**
   * Escopo é o par, não a fila: serializar globalmente faria a mensagem do contato A
   * esperar a do contato B, matando a vazão sem ganhar ordem que importe — ordem só é
   * observável dentro de uma conversa.
   */
  it('não bloqueia destinos diferentes na mesma linha', async () => {
    const { redis } = fakeRedis()

    const a = await acquireDestinationLock(redis, 'inst-1', '5511999999999')
    const b = await acquireDestinationLock(redis, 'inst-1', '5511888888888')

    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
  })

  it('não bloqueia o mesmo destino em linhas diferentes', async () => {
    const { redis } = fakeRedis()

    const a = await acquireDestinationLock(redis, 'inst-1', '5511999999999')
    const b = await acquireDestinationLock(redis, 'inst-2', '5511999999999')

    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
  })

  it('grava com TTL e NX', async () => {
    const { redis, set } = fakeRedis()

    await acquireDestinationLock(redis, 'inst-1', '5511999999999')

    expect(set).toHaveBeenCalledWith(
      'thinkzap:widget-send-lock:inst-1:5511999999999',
      expect.any(String),
      'PX',
      expect.any(Number),
      'NX',
    )
  })

  /**
   * O caso que o token de posse existe para evitar: um worker lento cujo TTL expirou
   * não pode apagar, ao terminar, o lock que o próximo dono acabou de pegar — os dois
   * enviariam ao mesmo tempo.
   */
  it('release do dono antigo não remove o lock do dono novo', async () => {
    const { redis, store } = fakeRedis()

    const stale = await acquireDestinationLock(redis, 'inst-1', '5511999999999')
    // TTL expirou: a chave some sem passar pelo release.
    store.clear()
    const fresh = await acquireDestinationLock(redis, 'inst-1', '5511999999999')

    await stale?.release()

    expect(store.has('thinkzap:widget-send-lock:inst-1:5511999999999')).toBe(
      true,
    )
    expect(fresh).not.toBeNull()
  })
})
