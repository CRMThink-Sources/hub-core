import cron from 'node-cron'
import { randomUUID } from 'crypto'
import { env } from '@/config/env'
import { redisConnection } from '@/queue/redis-connection'
import { makeExpireSubscriptions } from '@/modules/application/main/make-expire-subscriptions'
import { apiLogger } from '@/shared/infra/logger'

/** Toda hora cheia: o atraso entre o fim do período e o status gravado fica < 1h. */
const SCHEDULE = '0 * * * *'

/**
 * Lock por rodada: várias instâncias da API agendam o mesmo cron, e só uma varre.
 * TTL abaixo do intervalo para um processo morto no meio não segurar a rodada
 * seguinte.
 */
const LOCK_KEY = 'subscription-expiration:tick'
const LOCK_TTL_MS = 55 * 60 * 1000
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`

async function withExpirationLock(fn: () => Promise<void>): Promise<boolean> {
  const token = randomUUID()
  const acquired = await redisConnection.set(
    LOCK_KEY,
    token,
    'PX',
    LOCK_TTL_MS,
    'NX',
  )
  if (acquired !== 'OK') return false
  try {
    await fn()
  } finally {
    await redisConnection.eval(RELEASE_SCRIPT, 1, LOCK_KEY, token)
  }
  return true
}

export type SubscriptionExpirationJobDeps = {
  enabled: boolean
  schedule: (expression: string, task: () => Promise<void>) => void
  withLock: (fn: () => Promise<void>) => Promise<boolean>
  makeUseCase: () => { execute(): Promise<unknown> }
}

const defaultDeps = (): SubscriptionExpirationJobDeps => ({
  enabled: env.payments.expiration.enabled,
  schedule: (expression, task) => {
    cron.schedule(expression, task)
  },
  withLock: withExpirationLock,
  makeUseCase: makeExpireSubscriptions,
})

/**
 * Agenda a varredura que grava `trial_expired`/`past_due` nas assinaturas da SPA
 * 1142 com período encerrado.
 *
 * Desligada, nem agenda: homologação divide o portal com produção, e só um
 * ambiente pode gravar status.
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

  const useCase = deps.makeUseCase()

  deps.schedule(SCHEDULE, async () => {
    try {
      const ran = await deps.withLock(async () => {
        await useCase.execute()
      })
      if (!ran) {
        apiLogger.info(
          { app: 'shared' },
          '[SubscriptionExpirationJob] Rodada pulada (outro processo tem o lock)',
        )
      }
    } catch (error) {
      apiLogger.error(
        { app: 'shared', err: error },
        '[SubscriptionExpirationJob] Erro inesperado na rodada',
      )
    }
  })

  apiLogger.info(
    { app: 'shared', schedule: SCHEDULE },
    '[SubscriptionExpirationJob] Agendado',
  )
}
