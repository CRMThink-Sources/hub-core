import cron from 'node-cron'
import { env } from '@/config/env'
import { SubscriptionExpirationLock } from '@/modules/application/domain/subscription-expiration-lock'
import {
  makeRunStripeSync,
  makeStripeSyncRunRepository,
} from '@/modules/thinkzap/main/make-stripe-sync'
import { apiLogger } from '@/shared/infra/logger'
import { redisStripeSyncLock } from './stripe-sync.lock'

/** Toda hora, no minuto 30: fora do :00 da verificação de assinaturas, que também usa o Bitrix. */
const SCHEDULE = '30 * * * *'

/** Quanto tempo o histórico de rodadas fica guardado. */
export const STRIPE_SYNC_RETENTION_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

export type StripeSyncJobDeps = {
  enabled: boolean
  schedule: (expression: string, task: () => Promise<void>) => void
  lock: SubscriptionExpirationLock
  makeService: () => {
    run(input: { trigger: 'scheduled' }): Promise<unknown>
  }
  cleanup: (startedBefore: Date) => Promise<number>
  clock: () => Date
}

const defaultDeps = (): StripeSyncJobDeps => ({
  enabled: env.payments.stripeSync.enabled,
  schedule: (expression, task) => {
    cron.schedule(expression, task)
  },
  lock: redisStripeSyncLock,
  makeService: makeRunStripeSync,
  cleanup: date => makeStripeSyncRunRepository().deleteStartedBefore(date),
  clock: () => new Date(),
})

/**
 * Agenda a sincronização Stripe → SPA 1142. Desligada, nem agenda: homologação usa a
 * conta de teste do Stripe e divide o portal com produção. Rodada que não pega o lock
 * não é registrada — outra instância (ou o "Rodar agora") já está sincronizando.
 */
export function startStripeSyncJob(
  overrides: Partial<StripeSyncJobDeps> = {},
): void {
  const deps = { ...defaultDeps(), ...overrides }

  if (!deps.enabled) {
    apiLogger.info(
      { app: 'thinkzap' },
      '[StripeSyncJob] Desligado (STRIPE_SYNC_ENABLED, chave de teste ou provider desligado)',
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
          { app: 'thinkzap' },
          '[StripeSyncJob] Rodada pulada (outro processo tem o lock)',
        )
        return
      }

      await service.run({ trigger: 'scheduled' })
    } catch (error) {
      apiLogger.error(
        { app: 'thinkzap', err: error },
        '[StripeSyncJob] Erro inesperado na rodada',
      )
    } finally {
      if (token) {
        await purgeOldRuns(deps)
        await deps.lock
          .release(token)
          .catch(error =>
            apiLogger.warn(
              { app: 'thinkzap', err: error },
              '[StripeSyncJob] Falha ao soltar o lock — expira pelo TTL',
            ),
          )
      }
    }
  })

  apiLogger.info(
    { app: 'thinkzap', schedule: SCHEDULE },
    '[StripeSyncJob] Agendado',
  )
}

/** Limpeza do histórico. Falha só vai para o log: a próxima rodada tenta de novo. */
async function purgeOldRuns(deps: StripeSyncJobDeps) {
  try {
    const cutoff = new Date(
      deps.clock().getTime() - STRIPE_SYNC_RETENTION_DAYS * DAY_MS,
    )
    await deps.cleanup(cutoff)
  } catch (error) {
    apiLogger.warn(
      { app: 'thinkzap', err: error },
      '[StripeSyncJob] Falha ao limpar histórico antigo',
    )
  }
}
