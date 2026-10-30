import cron from 'node-cron'
import { env } from '@/config/env'
import { SubscriptionExpirationLock } from '@/modules/application/domain/subscription-expiration-lock'
import { makeReconcileCrmthinkTasks } from '@/modules/product-updates/main/make-sync-crmthink-task'
import { apiLogger } from '@/shared/infra/logger'
import { redisCrmthinkTasksReconcileLock } from './crmthink-tasks-reconcile.lock'

/**
 * Toda hora, no minuto 15: fora do :00 da verificação de assinaturas e do :30 da
 * sincronização Stripe, que também usam o Bitrix.
 */
const SCHEDULE = '15 * * * *'

export type CrmthinkTasksReconcileJobDeps = {
  enabled: boolean
  schedule: (expression: string, task: () => Promise<void>) => void
  lock: SubscriptionExpirationLock
  makeService: () => { execute(): Promise<unknown> }
}

const defaultDeps = (): CrmthinkTasksReconcileJobDeps => ({
  enabled: env.crmthinkTasks.syncEnabled,
  schedule: (expression, task) => {
    cron.schedule(expression, task)
  },
  lock: redisCrmthinkTasksReconcileLock,
  makeService: makeReconcileCrmthinkTasks,
})

/**
 * Agenda a reconciliação das tarefas das novidades (D6) — a rede para evento de
 * webhook perdido. Desligada (`CRMTHINK_TASKS_SYNC_ENABLED`), nem agenda: homologação
 * divide o portal com produção (D8). Rodada que não pega o lock é pulada — outra
 * instância já está reconciliando.
 */
export function startCrmthinkTasksReconcileJob(
  overrides: Partial<CrmthinkTasksReconcileJobDeps> = {},
): void {
  const deps = { ...defaultDeps(), ...overrides }

  if (!deps.enabled) {
    apiLogger.info(
      { app: 'product-updates' },
      '[CrmthinkTasksReconcileJob] Desligado (CRMTHINK_TASKS_SYNC_ENABLED)',
    )
    return
  }

  const service = deps.makeService()

  deps.schedule(SCHEDULE, async () => {
    let token: string | null = null

    try {
      token = await deps.lock.tryAcquire()
      if (!token) {
        apiLogger.info(
          { app: 'product-updates' },
          '[CrmthinkTasksReconcileJob] Rodada pulada (outro processo tem o lock)',
        )
        return
      }

      await service.execute()
    } catch (error) {
      apiLogger.error(
        { app: 'product-updates', err: error },
        '[CrmthinkTasksReconcileJob] Erro inesperado na rodada',
      )
    } finally {
      if (token) {
        await deps.lock
          .release(token)
          .catch(error =>
            apiLogger.warn(
              { app: 'product-updates', err: error },
              '[CrmthinkTasksReconcileJob] Falha ao soltar o lock — expira pelo TTL',
            ),
          )
      }
    }
  })

  apiLogger.info(
    { app: 'product-updates', schedule: SCHEDULE },
    '[CrmthinkTasksReconcileJob] Agendado',
  )
}
