import { ProductUpdateActionRefusedError } from '../domain/errors/product-update.errors'
import type {
  CrmthinkTaskMessages,
  CrmthinkTasksGateway,
} from '../domain/ports/crmthink-tasks-gateway.port'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import { loadProductUpdate } from './helpers/product-update-actions'

/**
 * Conversa da tarefa vinculada à novidade (D13), da mais antiga para a mais nova.
 * Só lê do Bitrix, então funciona com a sincronização desligada.
 *
 * Recusas: novidade inexistente → `404`; sem tarefa vinculada → `409 no-task-linked`;
 * tarefa que o webhook não lê → `CrmthinkTaskNotFoundError`.
 */
export class ListCrmthinkTaskMessages {
  constructor(
    private readonly repository: ProductUpdateRepository,
    private readonly gateway: CrmthinkTasksGateway,
  ) {}

  async execute(input: { id: string }): Promise<CrmthinkTaskMessages> {
    const update = await loadProductUpdate(this.repository, input.id)
    if (update.bitrixTaskId === null) {
      throw new ProductUpdateActionRefusedError('no-task-linked')
    }
    return this.gateway.listTaskMessages(update.bitrixTaskId)
  }
}
