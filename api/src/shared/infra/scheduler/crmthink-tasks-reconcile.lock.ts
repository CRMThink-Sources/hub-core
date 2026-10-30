import { randomUUID } from 'crypto'
import { redisConnection } from '@/queue/redis-connection'
import { SubscriptionExpirationLock } from '@/modules/application/domain/subscription-expiration-lock'

/**
 * Lock próprio da reconciliação das tarefas das novidades — mesmo formato e mesmo TTL
 * do lock da sincronização Stripe. Com várias instâncias da API, só uma relê o Bitrix
 * por hora.
 */
const LOCK_KEY = 'crmthink-tasks-reconcile:tick'
const LOCK_TTL_MS = 55 * 60 * 1000
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`

export const redisCrmthinkTasksReconcileLock: SubscriptionExpirationLock = {
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
