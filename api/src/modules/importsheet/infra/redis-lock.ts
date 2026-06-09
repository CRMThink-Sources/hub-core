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
