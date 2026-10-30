import { apiLogger } from '@/shared/infra/logger'
import type { ProductUpdate } from '../domain/entities/product-update'
import {
  CRMTHINK_TASKS_BATCH_SIZE,
  type CrmthinkTask,
  type CrmthinkTasksGateway,
} from '../domain/ports/crmthink-tasks-gateway.port'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import { withTaskStatus, withoutTask } from './helpers/crmthink-task-actions'
import type { Clock } from './helpers/product-update-actions'
import { logTaskSync } from './sync-crmthink-task'

export type ReconcileCrmthinkTasksResult = {
  /** Novidades com tarefa e ainda não disponíveis no início da rodada. */
  total: number
  synced: number
  unlinked: number
  /** Novidades que ficaram para a próxima rodada (lote ou gravação com erro). */
  failed: number
  failedBatches: number
}

/**
 * Reconciliação periódica (D6): rede de segurança para evento de webhook perdido.
 *
 * Relê as novidades com tarefa e sem `availableAt` em lotes de 50 — **uma** chamada de
 * `getTasks` por lote, porque o gateway rejeita a chamada inteira quando um lote falha;
 * chamando lote a lote, a falha fica isolada nele e os outros seguem. Tarefa ausente do
 * resultado não existe mais (ou não é visível) e é desvinculada, como no `ONTASKDELETE`.
 *
 * Nunca lança por falha de lote ou de gravação: loga e conta. A próxima rodada tenta de
 * novo — a regra é idempotente.
 */
export class ReconcileCrmthinkTasks {
  constructor(
    private readonly repository: ProductUpdateRepository,
    private readonly gateway: CrmthinkTasksGateway,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(): Promise<ReconcileCrmthinkTasksResult> {
    const updates = await this.repository.listReconcilable()
    const result: ReconcileCrmthinkTasksResult = {
      total: updates.length,
      synced: 0,
      unlinked: 0,
      failed: 0,
      failedBatches: 0,
    }

    for (let i = 0; i < updates.length; i += CRMTHINK_TASKS_BATCH_SIZE) {
      await this.reconcileBatch(
        updates.slice(i, i + CRMTHINK_TASKS_BATCH_SIZE),
        result,
      )
    }

    apiLogger.info(
      { app: 'product-updates', ...result },
      'Reconciliação das tarefas das novidades concluída',
    )
    return result
  }

  private async reconcileBatch(
    batch: ProductUpdate[],
    result: ReconcileCrmthinkTasksResult,
  ): Promise<void> {
    let tasks: CrmthinkTask[]
    try {
      tasks = await this.gateway.getTasks(batch.map(u => u.bitrixTaskId!))
    } catch (error) {
      result.failedBatches += 1
      result.failed += batch.length
      apiLogger.error(
        {
          app: 'product-updates',
          taskIds: batch.map(u => u.bitrixTaskId),
          err: error,
        },
        'Falha ao ler lote de tarefas no Bitrix — fica para a próxima rodada',
      )
      return
    }

    const byId = new Map(tasks.map(t => [t.id, t]))
    const now = this.now()

    // Gravação isolada por novidade: uma falha não leva o resto do lote junto.
    for (const listed of batch) {
      const taskId = listed.bitrixTaskId!
      const task = byId.get(taskId)
      try {
        /**
         * Relida logo antes de gravar: `save` substitui a linha inteira, e a leitura do
         * lote é de antes da chamada ao Bitrix — gravar a cópia velha desfaria uma
         * edição feita no backoffice nesse meio tempo. Desvinculada (ou trocada de
         * tarefa) nesse intervalo, fica como está.
         */
        const update = await this.repository.findById(listed.id)
        if (!update || update.bitrixTaskId !== taskId) continue

        if (task) {
          await this.repository.save(withTaskStatus(update, task, now))
          result.synced += 1
        } else {
          const saved = await this.repository.save(withoutTask(update))
          logTaskSync('task-deleted', saved, 'reconcile')
          result.unlinked += 1
        }
      } catch (error) {
        result.failed += 1
        apiLogger.error(
          {
            app: 'product-updates',
            productUpdateId: listed.id,
            taskId,
            err: error,
          },
          'Falha ao gravar a reconciliação da novidade — fica para a próxima rodada',
        )
      }
    }
  }
}
