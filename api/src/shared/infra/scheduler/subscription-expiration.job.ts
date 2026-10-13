import cron from 'node-cron'
import { env } from '@/config/env'
import { SubscriptionExpirationLock } from '@/modules/application/domain/subscription-expiration-lock'
import {
  makeRunSubscriptionExpiration,
  makeSubscriptionExpirationRunRepository,
} from '@/modules/application/main/make-run-subscription-expiration'
import { apiLogger } from '@/shared/infra/logger'
import { redisSubscriptionExpirationLock } from './subscription-expiration.lock'

/** Toda hora cheia: o atraso entre o fim do período e o status gravado fica < 1h. */
const SCHEDULE = '0 * * * *'

/** Quanto tempo o histórico de rodadas fica guardado. */
export const RUN_RETENTION_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

export type SubscriptionExpirationJobDeps = {
  enabled: boolean
  schedule: (expression: string, task: () => Promise<void>) => void
  lock: SubscriptionExpirationLock
  makeService: () => {
    run(input: { trigger: 'scheduled' }): Promise<unknown>
  }
  /** Apaga rodadas iniciadas antes da data; devolve quantas. */
  cleanup: (startedBefore: Date) => Promise<number>
  clock: () => Date
}

const defaultDeps = (): SubscriptionExpirationJobDeps => ({
  enabled: env.payments.expiration.enabled,
  schedule: (expression, task) => {
    cron.schedule(expression, task)
  },
  lock: redisSubscriptionExpirationLock,
  makeService: makeRunSubscriptionExpiration,
  cleanup: date =>
    makeSubscriptionExpirationRunRepository().deleteStartedBefore(date),
  clock: () => new Date(),
})

/**
 * Agenda a varredura que grava `trial_expired`/`past_due` nas assinaturas da SPA
 * 1142 com período encerrado, registrando cada rodada no histórico.
 *
 * Desligada, nem agenda: homologação divide o portal com produção, e só um
 * ambiente pode gravar status. Rodada que não pega o lock não é registrada — outra
 * instância (ou o "Rodar agora") já está varrendo.
 */
export function startSubscriptionExpirationJob(
  overrides: Partial<SubscriptionExpirationJobDeps> = {},
): void {
  const deps = { ...defaultDeps(), ...overrides }

  if (!deps.enabled) {
    apiLogger.info(
      { app: 'shared' },
      '[SubscriptionExpirationJob] Desligado (SUBSCRIPTION_EXPIRATION_ENABLED)',
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
          { app: 'shared' },
          '[SubscriptionExpirationJob] Rodada pulada (outro processo tem o lock)',
        )
        return
      }

      await service.run({ trigger: 'scheduled' })
    } catch (error) {
      apiLogger.error(
        { app: 'shared', err: error },
        '[SubscriptionExpirationJob] Erro inesperado na rodada',
      )
    } finally {
      if (token) {
        await purgeOldRuns(deps)
        await deps.lock
          .release(token)
          .catch(error =>
            apiLogger.warn(
              { app: 'shared', err: error },
              '[SubscriptionExpirationJob] Falha ao soltar o lock — expira pelo TTL',
            ),
          )
      }
    }
  })

  apiLogger.info(
    { app: 'shared', schedule: SCHEDULE },
    '[SubscriptionExpirationJob] Agendado',
  )
}

/** Limpeza do histórico. Falha só vai para o log: a próxima rodada tenta de novo. */
async function purgeOldRuns(deps: SubscriptionExpirationJobDeps) {
  try {
    const cutoff = new Date(
      deps.clock().getTime() - RUN_RETENTION_DAYS * DAY_MS,
    )
    await deps.cleanup(cutoff)
  } catch (error) {
    apiLogger.warn(
      { app: 'shared', err: error },
      '[SubscriptionExpirationJob] Falha ao limpar histórico antigo',
    )
  }
}
