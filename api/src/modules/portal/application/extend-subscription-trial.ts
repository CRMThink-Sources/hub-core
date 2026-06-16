import { env } from '@/config/env'
import { prisma } from '@/config/prisma'
import { SubscriptionStatus } from '@/shared/domain/entities/billing-subscription'
import {
  PortalAppNotFoundError,
  PortalSubscriptionNotFoundError,
} from '../domain/errors/portal-domain.errors'
import Stripe from 'stripe'

export type ExtendSubscriptionTrialInput = {
  appId: string
  subscriptionId: string
  trialEndsAt: Date
}

export type ExtendSubscriptionTrialOutput = {
  id: string
  trialEndsAt: Date
}

export async function extendSubscriptionTrial(
  input: ExtendSubscriptionTrialInput,
): Promise<ExtendSubscriptionTrialOutput> {
  const app = await prisma.app.findUnique({ where: { id: input.appId } })
  if (!app) throw new PortalAppNotFoundError()

  const sub = await prisma.billingSubscription.findFirst({
    where: { id: input.subscriptionId, appId: input.appId },
  })
  if (!sub) throw new PortalSubscriptionNotFoundError()

  if ((sub.status as SubscriptionStatus) !== SubscriptionStatus.TRIALING) {
    throw new Error('Subscription is not in trial period')
  }

  if (input.trialEndsAt <= new Date()) {
    throw new Error('New trial end date must be in the future')
  }

  const stripe = new Stripe(env.stripe.secretKey)
  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    trial_end: Math.floor(input.trialEndsAt.getTime() / 1000),
  })

  const updated = await prisma.billingSubscription.update({
    where: { id: sub.id },
    data: { trialEndsAt: input.trialEndsAt },
  })

  return { id: updated.id, trialEndsAt: updated.trialEndsAt! }
}
