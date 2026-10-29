import type { ProductUpdate } from '../domain/entities/product-update'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import { withoutTask } from './helpers/crmthink-task-actions'
import {
  ProductUpdateActionInput,
  loadProductUpdate,
  logProductUpdateAction,
} from './helpers/product-update-actions'

/**
 * Desvincula a tarefa: limpa `bitrixTask*` e mantém a situação (conclusão,
 * visibilidade e datas ficam). Não toca no Bitrix — a tarefa continua lá. Sem tarefa
 * vinculada, devolve a novidade como está (repetível).
 */
export class UnlinkCrmthinkTask {
  constructor(private readonly repository: ProductUpdateRepository) {}

  async execute(input: ProductUpdateActionInput): Promise<ProductUpdate> {
    const update = await loadProductUpdate(this.repository, input.id)
    if (update.bitrixTaskId === null) return update

    const saved = await this.repository.save(withoutTask(update))

    logProductUpdateAction('unlink-task', saved, input.portalUserId)
    return saved
  }
}
