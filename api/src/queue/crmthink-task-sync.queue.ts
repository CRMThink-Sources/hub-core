import { Queue } from 'bullmq'
import { bullBaseOptions } from './redis-connection'
import { apiLogger } from '@/shared/infra/logger'

export const CRMTHINK_TASK_SYNC = 'crmthink-task-sync'

/** Único nome de job da fila. */
export const CRMTHINK_TASK_SYNC_JOB = 'sync-task'

export type CrmthinkTaskSyncJob = {
  /** Id da tarefa no portal da CRMThink, como vem em `data[FIELDS_AFTER][ID]`. */
  taskId: number
  /** Correlação com a linha do webhook que originou o job. */
  traceKey: string
}

/**
 * Atraso antes de reler a tarefa. É o que coalesce a rajada: editar uma tarefa no
 * Bitrix costuma disparar vários `ONTASKUPDATE` seguidos, e todos caem no mesmo job
 * enquanto ele espera.
 */
export const CRMTHINK_TASK_SYNC_DELAY_MS = 5000

/**
 * Releitura das tarefas vinculadas a novidades do ThinkZap, enfileirada pelo webhook
 * `ONTASKUPDATE` e consumida pelo worker de `spa-item-resource-sync` (D5) — o mesmo
 * processo que já fala com o portal da CRMThink.
 */
export const crmthinkTaskSyncQueue = new Queue<CrmthinkTaskSyncJob>(
  CRMTHINK_TASK_SYNC,
  bullBaseOptions,
)

/**
 * Id determinístico por tarefa: o BullMQ colapsa `add` de mesmo id enquanto o job
 * existe. Separador `-`, nunca `:` (o BullMQ recusa id custom com dois-pontos).
 */
export const crmthinkTaskSyncJobId = (taskId: number): string =>
  `task-${taskId}`

/**
 * `removeOnComplete` é o que torna o `jobId` fixo seguro aqui: sem ele, o job concluído
 * ficaria retido com o mesmo id e **todo** evento posterior da tarefa (reabrir depois
 * de concluir, por exemplo) seria colapsado nele e descartado. O falho fica um dia
 * para diagnóstico — nesse intervalo a reconciliação horária cobre a tarefa.
 */
const OPTIONS = {
  delay: CRMTHINK_TASK_SYNC_DELAY_MS,
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: true,
  removeOnFail: { age: 24 * 60 * 60 },
}

/**
 * Enfileira a releitura da tarefa. Evento que chega com o job já em execução é
 * colapsado nele e se perde se a leitura do Bitrix já tiver acontecido — a
 * reconciliação horária é a rede para esse caso.
 */
export async function enqueueCrmthinkTaskSyncJob(job: CrmthinkTaskSyncJob) {
  const created = await crmthinkTaskSyncQueue.add(CRMTHINK_TASK_SYNC_JOB, job, {
    ...OPTIONS,
    jobId: crmthinkTaskSyncJobId(job.taskId),
  })

  apiLogger.debug(
    {
      app: 'product-updates',
      queue: CRMTHINK_TASK_SYNC,
      jobId: created.id,
      taskId: job.taskId,
      traceKey: job.traceKey,
    },
    'Releitura da tarefa da novidade enfileirada',
  )

  return created
}
