import { applyTaskStatus } from '../../domain/apply-task-status'
import type { ProductUpdate } from '../../domain/entities/product-update'
import { TasksSyncDisabledError } from '../../domain/errors/product-update.errors'
import type {
  CrmthinkTask,
  CrmthinkTasksConfig,
} from '../../domain/ports/crmthink-tasks-gateway.port'

/** Escritas no Bitrix (criar, concluir, reabrir) só com a sincronização ligada. */
export function assertTasksSyncEnabled(config: CrmthinkTasksConfig): void {
  if (!config.syncEnabled) throw new TasksSyncDisabledError()
}

/** A novidade com a regra de conclusão aplicada ao estado lido da tarefa (D3). */
export function withTaskStatus(
  update: ProductUpdate,
  task: CrmthinkTask,
  now: Date,
  completedBy?: string,
): ProductUpdate {
  return {
    ...update,
    ...applyTaskStatus(
      update,
      {
        id: task.id,
        title: task.title,
        status: task.status,
        groupId: task.groupId,
      },
      { now, completedBy },
    ),
  }
}

/** Sem tarefa: limpa o vínculo e o cache, sem mexer na conclusão. */
export function withoutTask(update: ProductUpdate): ProductUpdate {
  return {
    ...update,
    bitrixTaskId: null,
    bitrixTaskTitle: null,
    bitrixTaskStatus: null,
    bitrixTaskGroupId: null,
    bitrixTaskSyncedAt: null,
  }
}
