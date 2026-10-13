import { randomUUID } from 'node:crypto'
import { redisConnection } from '@/queue/redis-connection'
import { clicksignError } from '../errors/catalog'

const LOCK_TTL_MS = 10_000
const RETRY_DELAY_MS = 100
const MAX_RETRIES = 100

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

// Evita last-write-wins no `originId` quando vários `sign` chegam juntos.
export async function withDocumentLock<T>(
  documentKey: string,
  fn: () => Promise<T>,
): Promise<T> {
  const lockKey = `clicksign:sign-lock:${documentKey}`
  const token = randomUUID()

  let acquired = false
  for (let i = 0; i < MAX_RETRIES; i++) {
    const ok = await redisConnection.set(
      lockKey,
      token,
      'PX',
      LOCK_TTL_MS,
      'NX',
    )
    if (ok === 'OK') {
      acquired = true
      break
    }
    await sleep(RETRY_DELAY_MS)
  }

  // Aborta em vez de rodar fn() sem proteção (reintroduziria o race).
  if (!acquired) {
    throw clicksignError(
      'clicksign.lock.acquire_failed',
      new Error(`Não foi possível adquirir o lock do documento ${documentKey}`),
    )
  }

  try {
    return await fn()
  } finally {
    // Libera só se ainda for o dono (TTL pode ter expirado).
    const current = await redisConnection.get(lockKey)
    if (current === token) await redisConnection.del(lockKey)
  }
}
