import { isAwaitingTaskApproval } from '../domain/apply-task-status'
import type { ProductUpdate } from '../domain/entities/product-update'
import {
  CrmthinkTaskNotFoundError,
  ProductUpdateActionRefusedError,
} from '../domain/errors/product-update.errors'
import type {
  CrmthinkTasksConfig,
  CrmthinkTasksGateway,
} from '../domain/ports/crmthink-tasks-gateway.port'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import {
  assertTasksSyncEnabled,
  withTaskStatus,
} from './helpers/crmthink-task-actions'
import {
  Clock,
  ProductUpdateActionInput,
  loadProductUpdate,
  logProductUpdateAction,
} from './helpers/product-update-actions'

export type CompleteProductUpdateResult = {
  update: ProductUpdate
  /**
   * A tarefa exige aprovação do criador e ficou "aguardando controle": a novidade
   * continua pendente e a tela avisa que a conclusão foi enviada para aprovação.
   */
  awaitingApproval: boolean
}

/**
 * "Marcar como concluída" (D7). Concluir não publica: a situação vai no máximo para
 * "Aguardando revisão".
 *
 * - **sem tarefa:** só a novidade — `DONE`, `doneAt` e `completedBy`;
 * - **com tarefa:** exige a sincronização ligada (`TasksSyncDisabledError`), conclui
 *   no Bitrix, relê o status e aplica a regra de conclusão (`completedBy` = quem
 *   agiu). No status 4 a novidade fica pendente e `awaitingApproval` vem `true`.
 *
 * Falha do Bitrix (inclusive na releitura) propaga e nada é gravado; o evento da
 * tarefa e a reconciliação acertam a novidade depois. Já concluída → `409
 * already-done`.
 */
export class CompleteProductUpdate {
  constructor(
    private readonly repository: ProductUpdateRepository,
    private readonly gateway: CrmthinkTasksGateway,
    private readonly config: CrmthinkTasksConfig,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(
    input: ProductUpdateActionInput,
  ): Promise<CompleteProductUpdateResult> {
    const update = await loadProductUpdate(this.repository, input.id)

    if (update.progress === 'DONE') {
      throw new ProductUpdateActionRefusedError('already-done')
    }

    let next: ProductUpdate
    if (update.bitrixTaskId === null) {
      next = {
        ...update,
        progress: 'DONE',
        doneAt: this.now(),
        completedBy: input.portalUserId,
      }
    } else {
      assertTasksSyncEnabled(this.config)
      const taskId = update.bitrixTaskId
      await this.gateway.completeTask(taskId)
      const task = await this.gateway.getTask(taskId)
      if (!task) throw new CrmthinkTaskNotFoundError(taskId)
      next = withTaskStatus(update, task, this.now(), input.portalUserId)
    }

    const saved = await this.repository.save(next)
    const awaitingApproval = isAwaitingTaskApproval(saved)

    logProductUpdateAction(
      awaitingApproval ? 'complete-awaiting-approval' : 'complete',
      saved,
      input.portalUserId,
    )
    return { update: saved, awaitingApproval }
  }
}
