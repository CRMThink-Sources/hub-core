import type { DailySendQuota } from '@/modules/thinkzap/domain/ports/daily-send-quota.port'
import { RedisDailySendQuota } from '@/modules/thinkzap/infra/queue/redis-daily-send-quota'
import { redisConnection } from '@/queue/redis-connection'

/** Sem estado próprio: o contador vive no Redis, então uma instância por chamador basta. */
export function makeDailySendQuota(): DailySendQuota {
  return new RedisDailySendQuota(redisConnection)
}
