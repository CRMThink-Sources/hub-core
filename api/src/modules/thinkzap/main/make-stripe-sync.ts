import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { BitrixStripeSubscriptionLister } from '@/modules/application/infra/bitrix/readers/bitrix-stripe-subscription.lister'
import { ApplyGatewaySubscriptionState } from '@/modules/thinkzap/application/apply-gateway-subscription-state'
import { RunStripeSync } from '@/modules/thinkzap/application/run-stripe-sync'
import { StartManualStripeSync } from '@/modules/thinkzap/application/start-manual-stripe-sync'
import { SyncStripeSubscriptions } from '@/modules/thinkzap/application/sync-stripe-subscriptions'
import { StripePaymentGateway } from '@/modules/thinkzap/infra/gateway/stripe-payment.gateway'
import { PrismaStripeSyncRunRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-stripe-sync-runs.repository'
import { redisStripeSyncLock } from '@/shared/infra/scheduler/stripe-sync.lock'
import { makeSubscriptionDeps } from './subscription/make-subscription-deps'

export const makeStripeSyncRunRepository = (): PrismaStripeSyncRunRepository =>
  new PrismaStripeSyncRunRepository(prisma)

/**
 * A sincronização com histórico. O gateway é o `StripePaymentGateway` direto, sem o
 * decorator de cache: a sincronização precisa do estado atual. A aplicação na SPA usa
 * as mesmas dependências do webhook (`makeSubscriptionDeps`).
 */
export const makeRunStripeSync = (): RunStripeSync => {
  const { subscriptions, items, providerBilling, bitrixClient } =
    makeSubscriptionDeps()

  return new RunStripeSync(
    new SyncStripeSubscriptions(
      new BitrixStripeSubscriptionLister(bitrixClient),
      new StripePaymentGateway(),
      new ApplyGatewaySubscriptionState(subscriptions, items, providerBilling),
      env.payments.stripe.environment,
    ),
    makeStripeSyncRunRepository(),
  )
}

/** "Rodar agora": mesma rodada, mesmo lock, mesma flag. */
export const makeStartManualStripeSync = (): StartManualStripeSync =>
  new StartManualStripeSync(
    env.payments.stripeSync.enabled,
    redisStripeSyncLock,
    makeRunStripeSync(),
  )
