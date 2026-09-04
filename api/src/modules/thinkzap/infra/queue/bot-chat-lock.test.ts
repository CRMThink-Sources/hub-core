import { beforeEach, describe, expect, it, vi } from 'vitest'
import type IORedis from 'ioredis'
import { acquireBotChatLock } from './bot-chat-lock'

const APP = 'app-1'
const CHAT = '1824'

/**
 * Redis de mentira com a semântica que importa: `SET NX` só grava se a chave não existe,
 * e o script Lua só apaga se o valor bate.
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

  return {
    redis: { set, eval: evalScript } as unknown as IORedis,
    store,
    set,
  }
}

describe('acquireBotChatLock', () => {
  beforeEach(() => vi.clearAllMocks())

  it('concede o lock quando o chat está livre', async () => {
    const { redis } = fakeRedis()

    expect(await acquireBotChatLock(redis, APP, CHAT)).not.toBeNull()
  })

  it('recusa o segundo turno do mesmo chat', async () => {
    // É o caso real: `MESSAGEADD` e `JOINCHAT` chegam juntos e a fila roda com
    // `concurrency: 10`. Sem isto os dois rodavam o fluxo e o cliente ouvia duas vezes.
    const { redis } = fakeRedis()

    const primeiro = await acquireBotChatLock(redis, APP, CHAT)
    const segundo = await acquireBotChatLock(redis, APP, CHAT)

    expect(primeiro).not.toBeNull()
    expect(segundo).toBeNull()
  })

  it('libera e o próximo turno entra', async () => {
    const { redis } = fakeRedis()

    const primeiro = await acquireBotChatLock(redis, APP, CHAT)
    await primeiro?.release()

    expect(await acquireBotChatLock(redis, APP, CHAT)).not.toBeNull()
  })

  it('chats diferentes não disputam', async () => {
    // Serializar globalmente faria o turno de um cliente esperar o de outro.
    const { redis } = fakeRedis()

    expect(await acquireBotChatLock(redis, APP, '1')).not.toBeNull()
    expect(await acquireBotChatLock(redis, APP, '2')).not.toBeNull()
  })

  it('instalações diferentes não disputam o mesmo número de chat', async () => {
    // `chatId` é único por portal, não global.
    const { redis } = fakeRedis()

    expect(await acquireBotChatLock(redis, 'app-1', CHAT)).not.toBeNull()
    expect(await acquireBotChatLock(redis, 'app-2', CHAT)).not.toBeNull()
  })

  it('não libera o lock de outro dono', async () => {
    // Worker lento cujo TTL venceu apagaria, ao terminar, o lock que o próximo acabou de
    // pegar — e os dois rodariam o turno ao mesmo tempo.
    const { redis, store } = fakeRedis()

    const primeiro = await acquireBotChatLock(redis, APP, CHAT)
    const chave = [...store.keys()][0] as string

    // Simula o TTL vencendo e outro worker assumindo.
    store.set(chave, 'token-de-outro-dono')
    await primeiro?.release()

    expect(store.get(chave)).toBe('token-de-outro-dono')
  })

  it('usa TTL e NX na aquisição', async () => {
    // Sem TTL, worker morto travaria o chat para sempre; sem NX, não haveria exclusão.
    const { redis, set } = fakeRedis()

    await acquireBotChatLock(redis, APP, CHAT)

    const [, , px, ttl, nx] = set.mock.calls[0] as [
      string,
      string,
      string,
      number,
      string,
    ]
    expect(px).toBe('PX')
    expect(ttl).toBeGreaterThan(0)
    expect(nx).toBe('NX')
  })
})
