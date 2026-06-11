import { randomUUID } from 'crypto'
import { redisConnection } from '@/queue/redis-connection'

/**
 * Lock distribuído simples no Redis (compartilhado entre API e worker).
 * `SET key token NX PX ttl` — só um processo segura a chave por vez.
 * Release confere o token via Lua pra não liberar lock de outro dono.
 */

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`

export async function acquireLock(
  key: string,
  ttlMs: number,
): Promise<string | null> {
  const token = randomUUID()
  const result = await redisConnection.set(key, token, 'PX', ttlMs, 'NX')
  return result === 'OK' ? token : null
}

export async function releaseLock(key: string, token: string): Promise<void> {
  await redisConnection.eval(RELEASE_SCRIPT, 1, key, token)
}

// Estende o TTL só se ainda for o dono (não renova lock de outro processo).
const RENEW_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end
`

// Como `withLock`, mas renova o TTL enquanto `fn` roda → job longo não libera o
// lock no meio. Processo morto → timer para → lock expira em ≤ttl.
export async function withRenewingLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const token = await acquireLock(key, ttlMs)
  if (!token) return null

  const renewEveryMs = Math.max(1000, Math.floor(ttlMs / 3))
  const timer = setInterval(() => {
    void redisConnection
      .eval(RENEW_SCRIPT, 1, key, token, String(ttlMs))
      .catch(() => {
        // Falha de renovação não derruba o job; pior caso = lock expira no ttl.
      })
  }, renewEveryMs)
  if (typeof timer.unref === 'function') timer.unref()

  try {
    return await fn()
  } finally {
    clearInterval(timer)
    await releaseLock(key, token)
  }
}

/**
 * Roda `fn` só se conseguir o lock. Se outro processo já segura, retorna
 * `null` sem executar (caso do tick — não duplica trabalho).
 */
export async function withLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const token = await acquireLock(key, ttlMs)
  if (!token) return null
  try {
    return await fn()
  } finally {
    await releaseLock(key, token)
  }
}
