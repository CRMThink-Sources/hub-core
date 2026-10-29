import { apiLogger } from '@/shared/infra/logger'
import type { ProductUpdate } from '../domain/entities/product-update'
import {
  CrmthinkTaskResponsibleRequiredError,
  ProductUpdateActionRefusedError,
  ProductUpdateIncompleteError,
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

export type CreateCrmthinkTaskForUpdateInput = ProductUpdateActionInput & {
  /** ID do usuário do portal da CRMThink (de `SearchCrmthinkUsers`). */
  responsibleId?: number | null
}

export type CreateCrmthinkTaskConfig = CrmthinkTasksConfig & {
  /**
   * Origem do front (`env.frontUrl`: `FRONT_URL`, ou `APP_URL`). Vazia, a descrição
   * sai sem o link — melhor que um link relativo que não abre de dentro do Bitrix.
   */
  backofficeBaseUrl: string
}

/** Link da edição da novidade no backoffice (`/admin/novidades/<id>`). */
export function productUpdateBackofficeUrl(
  baseUrl: string,
  id: string,
): string | null {
  const base = baseUrl.trim().replace(/\/+$/, '')
  return base ? `${base}/admin/novidades/${id}` : null
}

/**
 * Cria a tarefa no projeto configurado, com título e descrição em português, o link
 * da novidade no backoffice e o responsável escolhido, e a vincula.
 *
 * Ordem das recusas, todas antes de qualquer escrita: sync desligada →
 * `TasksSyncDisabledError`; sem responsável → `422`; novidade inexistente → `404`;
 * já com tarefa → `409 task-already-set`; sem título em português → `422` (`pt`).
 *
 * A regra de conclusão é aplicada à tarefa nova como a qualquer vínculo: uma
 * novidade concluída e ainda não disponível volta a pendente (a tarefa acabou de
 * nascer aberta — a reconciliação faria o mesmo na hora seguinte).
 */
export class CreateCrmthinkTaskForUpdate {
  constructor(
    private readonly repository: ProductUpdateRepository,
    private readonly gateway: CrmthinkTasksGateway,
    private readonly config: CreateCrmthinkTaskConfig,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(
    input: CreateCrmthinkTaskForUpdateInput,
  ): Promise<ProductUpdate> {
    assertTasksSyncEnabled(this.config)

    const responsibleId = input.responsibleId
    if (
      typeof responsibleId !== 'number' ||
      !Number.isInteger(responsibleId) ||
      responsibleId <= 0
    ) {
      throw new CrmthinkTaskResponsibleRequiredError()
    }

    const update = await loadProductUpdate(this.repository, input.id)
    if (update.bitrixTaskId !== null) {
      throw new ProductUpdateActionRefusedError('task-already-set')
    }
    const { title, description } = update.content.pt
    if (!title) throw new ProductUpdateIncompleteError(['pt'])

    const link = productUpdateBackofficeUrl(
      this.config.backofficeBaseUrl,
      update.id,
    )
    const task = await this.gateway.createTask({
      title,
      description: [description, link && `Novidade no backoffice: ${link}`]
        .filter(Boolean)
        .join('\n\n'),
      groupId: this.config.groupId,
      responsibleId,
    })

    try {
      const saved = await this.repository.save(
        withTaskStatus(update, task, this.now()),
      )
      logProductUpdateAction('create-task', saved, input.portalUserId)
      return saved
    } catch (error) {
      // A tarefa já existe no Bitrix: o ID no log permite vinculá-la à mão.
      apiLogger.error(
        {
          app: 'product-updates',
          productUpdateId: update.id,
          bitrixTaskId: task.id,
          err: error,
        },
        'Tarefa criada no Bitrix, mas o vínculo com a novidade não foi gravado',
      )
      throw error
    }
  }
}
