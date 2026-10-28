import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { RunSubscriptionExpiration } from '@/modules/application/application/run-subscription-expiration'
import { StartManualSubscriptionExpiration } from '@/modules/application/application/start-manual-subscription-expiration'
import { PrismaSubscriptionExpirationRunRepository } from '@/modules/application/infra/prisma/repositories/prisma-subscription-expiration-runs.repository'
import { redisSubscriptionExpirationLock } from '@/shared/infra/scheduler/subscription-expiration.lock'
import { makeExpireSubscriptions } from './make-expire-subscriptions'

export const makeSubscriptionExpirationRunRepository =
  (): PrismaSubscriptionExpirationRunRepository =>
    new PrismaSubscriptionExpirationRunRepository(prisma)

/** A varredura com histórico — usada pelo cron e pelo disparo manual. */
export const makeRunSubscriptionExpiration = (): RunSubscriptionExpiration =>
  new RunSubscriptionExpiration(
    makeExpireSubscriptions(),
    makeSubscriptionExpirationRunRepository(),
    () => new Date(),
    {
      hour: env.payments.expiration.reconcileHour,
      timeZone: env.payments.expiration.reconcileTimeZone,
    },
  )

/** "Rodar agora" do backoffice: mesma varredura, mesmo lock, mesma flag. */
export const makeStartManualSubscriptionExpiration =
  (): StartManualSubscriptionExpiration =>
    new StartManualSubscriptionExpiration(
      env.payments.expiration.enabled,
      redisSubscriptionExpirationLock,
      makeRunSubscriptionExpiration(),
    )
