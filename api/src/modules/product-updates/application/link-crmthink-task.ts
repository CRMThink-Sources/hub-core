import type { ProductUpdate } from '../domain/entities/product-update'
import {
  CrmthinkTaskNotFoundError,
  ProductUpdateActionRefusedError,
  TaskAlreadyLinkedError,
} from '../domain/errors/product-update.errors'
import type { CrmthinkTasksGateway } from '../domain/ports/crmthink-tasks-gateway.port'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import { withTaskStatus } from './helpers/crmthink-task-actions'
import {
  Clock,
  ProductUpdateActionInput,
  loadProductUpdate,
  logProductUpdateAction,
} from './helpers/product-update-actions'

export type LinkCrmthinkTaskInput = ProductUpdateActionInput & {
  taskId: number
}

/**
 * Vincula uma tarefa existente (de qualquer grupo) e aplica a regra de conclusão ao
 * status atual dela — vincular uma tarefa concluída conclui a novidade. Só lê do
 * Bitrix, então funciona com a sincronização desligada.
 *
 * Recusas: novidade já com outra tarefa → `409 task-already-set` (desvincule antes);
 * tarefa já usada por outra novidade → `TaskAlreadyLinkedError` (`409` com a dona),
 * conferido antes de ir ao Bitrix e de novo pelo índice único ao gravar; tarefa
 * inexistente → `CrmthinkTaskNotFoundError`. Vincular de novo a mesma tarefa só
 * relê o status.
 */
export class LinkCrmthinkTask {
  constructor(
    private readonly repository: ProductUpdateRepository,
    private readonly gateway: CrmthinkTasksGateway,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(input: LinkCrmthinkTaskInput): Promise<ProductUpdate> {
    const update = await loadProductUpdate(this.repository, input.id)

    if (update.bitrixTaskId !== null && update.bitrixTaskId !== input.taskId) {
      throw new ProductUpdateActionRefusedError('task-already-set')
    }
    const owner = await this.repository.findByBitrixTaskId(input.taskId)
    if (owner && owner.id !== update.id) {
      throw new TaskAlreadyLinkedError(input.taskId, owner.id)
    }

    const task = await this.gateway.getTask(input.taskId)
    if (!task) throw new CrmthinkTaskNotFoundError(input.taskId)

    const saved = await this.repository.save(
      withTaskStatus(update, task, this.now()),
    )

    logProductUpdateAction('link-task', saved, input.portalUserId)
    return saved
  }
}
