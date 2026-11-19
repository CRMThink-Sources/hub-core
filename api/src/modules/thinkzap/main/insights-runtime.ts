import { env } from '@/config/env'
import { redisConnection } from '@/queue/redis-connection'
import { configureKeyHealth } from '../application/insights/key-health'
import { makeInsightsKeys } from '../application/insights/insights-keys'
import { InsightsResultStore } from '../application/insights/insights-result-store'
import { RedisInsightsKv } from '../infra/insights/redis-insights-kv'

/**
 * Armazenamento compartilhado do Insights, montado uma vez por processo. A API
 * e o worker de cálculo importam daqui e enxergam as mesmas chaves, que levam o
 * ambiente (`QUEUE_PREFIX`) porque as chaves de aplicação não têm prefixo.
 *
 * Importar este módulo também aponta o estado da chave Vibecode (`key-health`)
 * para o Redis: sem isso cada processo teria o seu próprio aviso em memória.
 */
export const insightsKv = new RedisInsightsKv(redisConnection)
export const insightsKeys = makeInsightsKeys(env.queuePrefix)
export const insightsStore = new InsightsResultStore({
  kv: insightsKv,
  keys: insightsKeys,
})

configureKeyHealth({ kv: insightsKv, keys: insightsKeys })
