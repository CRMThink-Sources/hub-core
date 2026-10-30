import { env } from '@/config/env'
import type { SyncCrmthinkTask } from '@/modules/product-updates/application/sync-crmthink-task'
import { makeSyncCrmthinkTask } from '@/modules/product-updates/main/make-sync-crmthink-task'
import {
  CRMTHINK_TASK_SYNC,
  type CrmthinkTaskSyncJob,
} from '@/queue/crmthink-task-sync.queue'
import { workerLogger } from '@/shared/infra/logger'

const log = workerLogger.child({ queue: CRMTHINK_TASK_SYNC })

export type CrmthinkTaskSyncDeps = {
  syncEnabled: boolean
  /** Montado por job, como nos outros processors: nada de cliente HTTP preso ao módulo. */
  makeSync: () => Pick<SyncCrmthinkTask, 'refresh'>
}

const defaultDeps = (): CrmthinkTaskSyncDeps => ({
  syncEnabled: env.crmthinkTasks.syncEnabled,
  makeSync: makeSyncCrmthinkTask,
})

/**
 * Relê a tarefa vinculada e aplica a regra de conclusão (D3). A novidade é relida pelo
 * id da tarefa: desvinculada depois do evento, o job termina sem efeito; tarefa que
 * sumiu do Bitrix desvincula.
 *
 * Falha do Bitrix propaga — é o que faz o BullMQ tentar de novo.
 */
export async function processCrmthinkTaskSync(
  job: CrmthinkTaskSyncJob,
  overrides: Partial<CrmthinkTaskSyncDeps> = {},
): Promise<void> {
  const deps = { ...defaultDeps(), ...overrides }

  /**
   * Defesa em profundidade da guarda do webhook, para o que já estava na fila quando a
   * flag foi desligada. Descartado sem erro: retentar não muda o ambiente.
   */
  if (!deps.syncEnabled) {
    log.info(
      {
        app: 'product-updates',
        taskId: job.taskId,
        traceKey: job.traceKey,
        outcome: 'disabled',
      },
      'Sincronização de tarefas desligada — job descartado',
    )
    return
  }

  const outcome = await deps.makeSync().refresh(job.taskId)

  log.debug(
    {
      app: 'product-updates',
      taskId: job.taskId,
      traceKey: job.traceKey,
      outcome,
    },
    'Releitura da tarefa da novidade concluída',
  )
}
