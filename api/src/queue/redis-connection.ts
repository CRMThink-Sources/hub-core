import { env } from '@/config/env'
import IORedis from 'ioredis'

const redisUrl = env.redisUrl
if (!redisUrl) throw new Error('REDIS_URL is required')

export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
})

/**
 * O que **toda** `Queue` e todo `Worker` recebe: a conexão e o prefixo do ambiente.
 *
 * Existe como objeto único, e não como duas opções repetidas em cada construção, porque
 * `Queue` e `Worker` precisam concordar no prefixo — divergir não dá erro, dá worker
 * ouvindo uma fila vazia enquanto o produtor escreve noutra. Espalhar `prefix` por
 * quatorze arquivos é convidar exatamente isso no décimo quinto.
 *
 * Coberto por `queue-prefix.guard.test.ts`, que falha se alguma construção não usar.
 *
 * **Só isola o BullMQ.** As chaves de aplicação no mesmo Redis — cache do `botId`, lock
 * de documento do Clicksign — não têm prefixo de ambiente, então ambientes distintos
 * seguem precisando de índices de DB distintos no `REDIS_URL`.
 */
export const bullBaseOptions = {
  connection: redisConnection,
  prefix: env.queuePrefix,
} as const
