import { apiLogger } from '@/shared/infra/logger'
import type { ProductUpdate } from '../domain/entities/product-update'
import { productUpdateSituation } from '../domain/entities/product-update'
import type { CrmthinkTasksGateway } from '../domain/ports/crmthink-tasks-gateway.port'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import { withTaskStatus, withoutTask } from './helpers/crmthink-task-actions'
import type { Clock } from './helpers/product-update-actions'

/** Desfecho de um evento de tarefa, para o log de quem chamou. */
export type CrmthinkTaskSyncOutcome = 'not-linked' | 'unlinked' | 'synced'

/**
 * Trilha das mudanças que vêm da tarefa, e não de alguém no backoffice — não há
 * `portalUserId`, então não é `logProductUpdateAction`.
 */
export function logTaskSync(
  action: 'task-deleted' | 'task-synced',
  update: ProductUpdate,
  source: 'webhook' | 'reconcile',
): void {
  apiLogger.info(
    {
      app: 'product-updates',
      action,
      source,
      productUpdateId: update.id,
      bitrixTaskStatus: update.bitrixTaskStatus,
      situation: productUpdateSituation(update),
    },
    'Novidade do ThinkZap atualizada pela tarefa do Bitrix',
  )
}

/**
 * Os eventos de tarefa do portal da CRMThink aplicados às novidades (D5), por id de
 * tarefa. A novidade é sempre **relida** pelo índice único de `bitrixTaskId`: entre o
 * evento e o processamento ela pode ter sido desvinculada — e aí não há nada a fazer.
 *
 * Usado pelo webhook (`findLinked` e `unlinkDeleted`, sem tocar no Bitrix) e pelo
 * worker da fila `crmthink-task-sync` (`refresh`).
 */
export class SyncCrmthinkTask {
  constructor(
    private readonly repository: ProductUpdateRepository,
    private readonly gateway: CrmthinkTasksGateway,
    private readonly now: Clock = () => new Date(),
  ) {}

  /** O filtro barato do webhook: só o banco, nunca o Bitrix. */
  findLinked(taskId: number): Promise<ProductUpdate | null> {
    return this.repository.findByBitrixTaskId(taskId)
  }

  /**
   * Tarefa excluída no Bitrix: desvincula e mantém a situação (conclusão,
   * visibilidade e datas ficam). Sem novidade vinculada, não faz nada.
   */
  async unlinkDeleted(
    taskId: number,
    source: 'webhook' | 'reconcile' = 'webhook',
  ): Promise<CrmthinkTaskSyncOutcome> {
    const update = await this.repository.findByBitrixTaskId(taskId)
    if (!update) return 'not-linked'

    const saved = await this.repository.save(withoutTask(update))
    logTaskSync('task-deleted', saved, source)
    return 'unlinked'
  }

  /**
   * Relê a tarefa e aplica a regra de conclusão (D3). Tarefa que não existe mais (ou
   * que o webhook não enxerga) é tratada como excluída e desvinculada.
   *
   * Falha do Bitrix propaga (`CrmthinkTasksUnavailableError`): no worker, é o que faz
   * o BullMQ tentar de novo.
   */
  async refresh(taskId: number): Promise<CrmthinkTaskSyncOutcome> {
    const update = await this.repository.findByBitrixTaskId(taskId)
    if (!update) return 'not-linked'

    const task = await this.gateway.getTask(taskId)
    if (!task) return this.unlinkDeleted(taskId)

    /**
     * Relida depois do Bitrix: `save` substitui a linha inteira, e gravar a cópia de
     * antes da chamada desfaria uma edição feita no backoffice nesse meio tempo.
     */
    const current = await this.repository.findByBitrixTaskId(taskId)
    if (!current) return 'not-linked'

    const saved = await this.repository.save(
      withTaskStatus(current, task, this.now()),
    )
    logTaskSync('task-synced', saved, 'webhook')
    return 'synced'
  }
}
