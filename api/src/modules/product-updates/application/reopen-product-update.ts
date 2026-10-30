import type { ProductUpdate } from '../domain/entities/product-update'
import { productUpdateSituation } from '../domain/entities/product-update'
import {
  CrmthinkTaskNotFoundError,
  ProductUpdateActionRefusedError,
} from '../domain/errors/product-update.errors'
import type {
  CrmthinkTasksConfig,
  CrmthinkTasksGateway,
} from '../domain/ports/crmthink-tasks-gateway.port'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import { assertTasksSyncEnabled } from './helpers/crmthink-task-actions'
import {
  Clock,
  ProductUpdateActionInput,
  loadProductUpdate,
  logProductUpdateAction,
} from './helpers/product-update-actions'

/**
 * "Desmarcar concluída" (D7): ação explícita, fora da regra de conclusão — grava
 * `PENDING` seja qual for o status que a tarefa assumir. Volta para "Em breve" se
 * publicada, rascunho se não.
 *
 * - **disponível** → `409 already-available` (a tarefa não mexe mais nela);
 * - **não concluída** → `409 not-done`;
 * - **despublicada que já foi disponível:** apaga `availableAt` — sem isso ela
 *   seguiria fora do alcance da tarefa e voltaria disponível ao republicar;
 * - **com tarefa:** exige a sincronização ligada, reabre no Bitrix e relê a tarefa
 *   para o cache. Falha do Bitrix propaga e nada é gravado.
 */
export class ReopenProductUpdate {
  constructor(
    private readonly repository: ProductUpdateRepository,
    private readonly gateway: CrmthinkTasksGateway,
    private readonly config: CrmthinkTasksConfig,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(input: ProductUpdateActionInput): Promise<ProductUpdate> {
    const update = await loadProductUpdate(this.repository, input.id)

    if (productUpdateSituation(update) === 'available') {
      throw new ProductUpdateActionRefusedError('already-available')
    }
    if (update.progress !== 'DONE') {
      throw new ProductUpdateActionRefusedError('not-done')
    }

    let next: ProductUpdate = {
      ...update,
      progress: 'PENDING',
      doneAt: null,
      completedBy: null,
      // Aqui `availableAt` preenchido só existe em despublicada (disponível já saiu).
      availableAt: null,
    }

    if (update.bitrixTaskId !== null) {
      assertTasksSyncEnabled(this.config)
      const taskId = update.bitrixTaskId
      await this.gateway.renewTask(taskId)
      const task = await this.gateway.getTask(taskId)
      if (!task) throw new CrmthinkTaskNotFoundError(taskId)
      next = {
        ...next,
        bitrixTaskTitle: task.title,
        bitrixTaskStatus: task.status,
        bitrixTaskGroupId: task.groupId,
        bitrixTaskSyncedAt: this.now(),
      }
    }

    const saved = await this.repository.save(next)

    logProductUpdateAction('reopen', saved, input.portalUserId)
    return saved
  }
}
