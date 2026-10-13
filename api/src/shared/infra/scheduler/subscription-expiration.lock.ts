import { randomUUID } from 'crypto'
import { redisConnection } from '@/queue/redis-connection'
import { SubscriptionExpirationLock } from '@/modules/application/domain/subscription-expiration-lock'

/**
 * Lock por rodada: várias instâncias da API agendam o mesmo cron, e o backoffice
 * pode disparar uma rodada manual — só uma varre. TTL abaixo do intervalo do cron
 * para um processo morto no meio não segurar a rodada seguinte.
 */
const LOCK_KEY = 'subscription-expiration:tick'
const LOCK_TTL_MS = 55 * 60 * 1000
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`

export const redisSubscriptionExpirationLock: SubscriptionExpirationLock = {
  async tryAcquire() {
    const token = randomUUID()
    const acquired = await redisConnection.set(
      LOCK_KEY,
      token,
      'PX',
      LOCK_TTL_MS,
      'NX',
    )
    return acquired === 'OK' ? token : null
  },

  async release(token) {
    await redisConnection.eval(RELEASE_SCRIPT, 1, LOCK_KEY, token)
  },
}
