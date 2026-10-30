import { ReconcileCrmthinkTasks } from '../application/reconcile-crmthink-tasks'
import { SyncCrmthinkTask } from '../application/sync-crmthink-task'
import { PrismaProductUpdateRepository } from '../infra/persistence/prisma-product-update.repository'
import { makeCrmthinkTasksGateway } from './make-crmthink-tasks-gateway'

/** Eventos de tarefa: usado pelo webhook e pelo worker da fila `crmthink-task-sync`. */
export const makeSyncCrmthinkTask = (): SyncCrmthinkTask =>
  new SyncCrmthinkTask(
    new PrismaProductUpdateRepository(),
    makeCrmthinkTasksGateway(),
  )

/** Reconciliação horária (`crmthink-tasks-reconcile.job.ts`). */
export const makeReconcileCrmthinkTasks = (): ReconcileCrmthinkTasks =>
  new ReconcileCrmthinkTasks(
    new PrismaProductUpdateRepository(),
    makeCrmthinkTasksGateway(),
  )
