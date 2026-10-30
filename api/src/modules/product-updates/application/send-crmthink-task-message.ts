import type { PortalUserRepository } from '@/modules/portal/domain/repositories/portal-user.repository'
import { apiLogger } from '@/shared/infra/logger'
import {
  BitrixUserNotLinkedError,
  InvalidTaskMessageError,
  ProductUpdateActionRefusedError,
} from '../domain/errors/product-update.errors'
import {
  CRMTHINK_TASK_MESSAGE_MAX_LENGTH,
  type CrmthinkTasksConfig,
  type CrmthinkTasksGateway,
} from '../domain/ports/crmthink-tasks-gateway.port'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import { assertTasksSyncEnabled } from './helpers/crmthink-task-actions'
import {
  ProductUpdateActionInput,
  loadProductUpdate,
} from './helpers/product-update-actions'

export type SendCrmthinkTaskMessageInput = ProductUpdateActionInput & {
  /** Vem do corpo da requisição; só string não vazia é aceita. */
  text: unknown
}

/**
 * Envia um comentário à tarefa vinculada, em nome do usuário do Bitrix vinculado ao
 * usuário do backoffice (D12/D13). Escreve no Bitrix, então exige a sincronização
 * ligada. Ordem das recusas: sincronização desligada (`409 tasks-sync-disabled`),
 * novidade inexistente (`404`), sem tarefa (`409 no-task-linked`), texto vazio ou
 * acima de 4000 caracteres depois do `trim` (`422 invalid-message`), usuário sem
 * vínculo com o Bitrix (`422 bitrix-user-not-linked`). Nada sai em nome do dono do
 * webhook.
 */
export class SendCrmthinkTaskMessage {
  constructor(
    private readonly repository: ProductUpdateRepository,
    private readonly portalUserRepository: Pick<
      PortalUserRepository,
      'findById'
    >,
    private readonly gateway: CrmthinkTasksGateway,
    private readonly config: CrmthinkTasksConfig,
  ) {}

  async execute(input: SendCrmthinkTaskMessageInput): Promise<void> {
    assertTasksSyncEnabled(this.config)
    const update = await loadProductUpdate(this.repository, input.id)
    const taskId = update.bitrixTaskId
    if (taskId === null) {
      throw new ProductUpdateActionRefusedError('no-task-linked')
    }

    const text = typeof input.text === 'string' ? input.text.trim() : ''
    if (!text || text.length > CRMTHINK_TASK_MESSAGE_MAX_LENGTH) {
      throw new InvalidTaskMessageError()
    }

    const user = await this.portalUserRepository.findById(input.portalUserId)
    if (!user || user.bitrixUserId === null) {
      throw new BitrixUserNotLinkedError()
    }

    await this.gateway.sendTaskMessage(taskId, text, user.bitrixUserId)

    apiLogger.info(
      {
        app: 'product-updates',
        action: 'send-task-message',
        productUpdateId: update.id,
        portalUserId: input.portalUserId,
        bitrixTaskId: taskId,
        bitrixUserId: user.bitrixUserId,
      },
      'Mensagem enviada à tarefa da novidade',
    )
  }
}
