import { randomUUID } from 'crypto'
import { env } from '@/config/env'
import { redisConnection } from '@/queue/redis-connection'
import { SubscriptionExpirationLock } from '@/modules/application/domain/subscription-expiration-lock'

/**
 * Lock próprio do expurgo das falhas de mensagens: duas instâncias da API disparando no
 * mesmo horário não apagam em dobro.
 *
 * A chave leva o `QUEUE_PREFIX`: locks e cache do Redis não têm prefixo, e ambientes que
 * dividem o Redis disputariam o mesmo lock. Mesmo formato do lock da sincronização Stripe.
 */
const LOCK_KEY = `${env.queuePrefix}:failure-retention:tick`
const LOCK_TTL_MS = 30 * 60 * 1000
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`

export const redisFailureRetentionLock: SubscriptionExpirationLock = {
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
