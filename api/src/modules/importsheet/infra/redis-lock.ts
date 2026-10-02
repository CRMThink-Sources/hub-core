import { randomUUID } from 'crypto'
import { redisConnection } from '@/queue/redis-connection'
import { apiLogger } from '@/shared/infra/logger'
import { logImportsheetError } from '@/modules/importsheet/errors/catalog'

// Confere o token pra não liberar lock de outro dono.
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

const RENEW_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end
`

// Renova o TTL enquanto `fn` roda; processo morto para o timer e o lock expira em ≤ttl.
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
      .catch((error: unknown) => {
        logImportsheetError(apiLogger, 'importsheet.run.lock_renew_failed', {
          app: 'importsheet',
          key,
          err: error,
        })
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
