import { env } from '@/config/env'
import { Controller } from '@/shared/presentation/controller'
import { makeSyncSubscriptionLinesBilling } from '@/modules/thinkzap/main/make-sync-subscription-lines-billing'
import {
  ActivateSubscription,
  DeactivateSubscription,
  SubscriptionStatusActionDeps,
} from '../../application/subscription-status-actions'
import { subscribeSubscriptionLines } from '../../application/subscribe-subscription-lines'
import { PrismaPortalAppReadRepository } from '../../infra/persistence/prisma-portal-app-read.repository'
import {
  ActivateSubscriptionController,
  DeactivateSubscriptionController,
  SubscribeSubscriptionLinesController,
} from '../../presentation/controllers/subscription-actions-controllers'
import { makePortalHydration } from '../make-portal-hydration'

/**
 * O repositório de assinatura é o mesmo, com cache, do detalhe do cliente: a escrita é
 * write-through, então a tela relida depois da ação já vê o status novo.
 */
const statusActionDeps = (): SubscriptionStatusActionDeps => ({
  apps: new PrismaPortalAppReadRepository(),
  subscriptions: makePortalHydration().subscriptions,
  providerEffectsEnabled: env.payments.spa.providerEffectsEnabled,
})

export const createActivateSubscriptionController = (): Controller =>
  new ActivateSubscriptionController(
    new ActivateSubscription(statusActionDeps()),
  )

export const createDeactivateSubscriptionController = (): Controller =>
  new DeactivateSubscriptionController(
    new DeactivateSubscription(statusActionDeps()),
  )

export const createSubscribeSubscriptionLinesController = (): Controller => {
  const deps = {
    ...statusActionDeps(),
    sync: makeSyncSubscriptionLinesBilling(),
  }

  return new SubscribeSubscriptionLinesController(input =>
    subscribeSubscriptionLines(input, deps),
  )
}
