import { env } from '@/config/env'
import { prisma } from '@/config/prisma'
import { SubscriptionStatus } from '@/shared/domain/entities/billing-subscription'
import {
  PortalAppNotFoundError,
  PortalSubscriptionNotFoundError,
} from '../domain/errors/portal-domain.errors'
import Stripe from 'stripe'

export type CancelSubscriptionTrialInput = {
  appId: string
  subscriptionId: string
}

export async function cancelSubscriptionTrial(
  input: CancelSubscriptionTrialInput,
): Promise<void> {
  const app = await prisma.app.findUnique({ where: { id: input.appId } })
  if (!app) throw new PortalAppNotFoundError()

  const sub = await prisma.billingSubscription.findFirst({
    where: { id: input.subscriptionId, appId: input.appId },
  })
  if (!sub) throw new PortalSubscriptionNotFoundError()

  if ((sub.status as SubscriptionStatus) !== SubscriptionStatus.TRIALING) {
    throw new Error('Subscription is not in trial period')
  }

  const stripe = new Stripe(env.stripe.secretKey)
  await stripe.subscriptions.cancel(sub.stripeSubscriptionId)

  await prisma.billingSubscription.update({
    where: { id: sub.id },
    data: { status: SubscriptionStatus.CANCELLED },
  })
}
