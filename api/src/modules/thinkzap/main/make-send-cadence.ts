import type { SendCadence } from '@/modules/thinkzap/domain/ports/send-cadence.port'
import { RedisSendCadence } from '@/modules/thinkzap/infra/queue/redis-send-cadence'
import { redisConnection } from '@/queue/redis-connection'

/** Sem estado próprio: janela e fila vivem no Redis, uma instância por chamador basta. */
export function makeSendCadence(): SendCadence {
  return new RedisSendCadence(redisConnection)
}
