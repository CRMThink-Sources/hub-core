import { Worker } from 'bullmq'
import { env } from '@/config/env'
import { GetInsightsConfig } from '@/modules/thinkzap/application/insights/get-insights-config'
import {
  insightsKeys,
  insightsKv,
  insightsStore,
} from '@/modules/thinkzap/main/insights-runtime'
import { makeInsightsSourceResolver } from '@/modules/thinkzap/main/make-insights-source-resolver'
import { KvSessionDayCache } from '@/modules/thinkzap/infra/insights/session-day-cache'
import { PrismaInsightsSettingsRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-insights-settings.repository'
import {
  INSIGHTS_COMPUTE,
  enqueueInsightsCompute,
  type InsightsComputeJob,
  type InsightsQueueJob,
} from '@/queue/insights-compute.queue'
import {
  INSIGHTS_PREWARM_TICK_JOB,
  ensureInsightsPrewarmTick,
} from '@/queue/insights-prewarm.queue'
import { bullBaseOptions } from '@/queue/redis-connection'
import { jobFailureLogFields } from '@/shared/infra/log-error'
import { workerLogger } from '@/shared/infra/logger'
import { processInsightsCompute } from './insights-compute.processor'
import { processInsightsPrewarm } from './insights-prewarm.processor'

const getConfig = new GetInsightsConfig({
  settings: new PrismaInsightsSettingsRepository(),
})

/**
 * Resolver novo a cada job: ele guarda a fonte do app em memória, e a invalidação
 * feita na API (salvar a chave) não alcança este processo. As sessões por dia
 * ficam no Redis, então não perder a fonte não custa releitura.
 */
const makeSources = () =>
  makeInsightsSourceResolver({
    dayCacheFor: appId =>
      new KvSessionDayCache(insightsKv, insightsKeys, appId),
    vibeOptions: {
      closedDayTtlMs: env.insights.closedDayTtlMs,
      chat429FinalWaitMs: env.insights.chat429FinalWaitMs,
    },
    invalidateResults: appId => insightsStore.invalidateApp(appId),
  })

// concurrency 1: um cálculo ocupa toda a cota de leitura da Vibe API (5 chats em
// paralelo já provocam 429); dois ao mesmo tempo reproduziriam o limite. Também é
// o que faz o pré-aquecimento rodar um app por vez. O cálculo leva minutos, mas é
// só I/O assíncrono: o BullMQ renova o lock do job sozinho.
export const insightsWorker = new Worker<InsightsQueueJob>(
  INSIGHTS_COMPUTE,
  async job => {
    // O tick do pré-aquecimento só agenda: os cálculos entram na mesma fila.
    if (job.name === INSIGHTS_PREWARM_TICK_JOB) {
      await processInsightsPrewarm({
        store: insightsStore,
        getConfig: appId => getConfig.execute(appId),
        enqueue: enqueueInsightsCompute,
      })
      return
    }
    await processInsightsCompute(job.data as InsightsComputeJob, {
      store: insightsStore,
      getConfig: appId => getConfig.execute(appId),
      makeSources,
    })
  },
  {
    ...bullBaseOptions,
    concurrency: 1,
  },
)

insightsWorker.on('failed', (job, err) => {
  // Log de transporte; o motivo do cálculo já foi logado no processor.
  workerLogger.error(
    {
      event: 'worker.job.failed',
      app: 'thinkzap',
      queue: INSIGHTS_COMPUTE,
      jobId: job?.id,
      jobName: job?.name,
      kind: job && 'kind' in job.data ? job.data.kind : undefined,
      appId: job && 'appId' in job.data ? job.data.appId : undefined,
      traceKey: job && 'traceKey' in job.data ? job.data.traceKey : undefined,
      attemptsMade: job?.attemptsMade,
      ...jobFailureLogFields(err),
    },
    'Cálculo do Insights falhou',
  )
})

insightsWorker.on('ready', () => {
  workerLogger.info(
    { event: 'worker.ready', app: 'thinkzap', queue: INSIGHTS_COMPUTE },
    'Insights worker is ready',
  )
})

// Idempotente: o BullMQ deduplica o job repetível, então pode rodar a cada boot.
void ensureInsightsPrewarmTick().catch((error: unknown) => {
  workerLogger.error(
    {
      event: 'worker.prewarm.schedule_failed',
      app: 'thinkzap',
      queue: INSIGHTS_COMPUTE,
      errorName: error instanceof Error ? error.name : 'unknown',
    },
    'Não foi possível agendar o pré-aquecimento do Insights',
  )
})
