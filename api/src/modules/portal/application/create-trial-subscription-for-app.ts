import { env } from '@/config/env'
import { prisma } from '@/config/prisma'
import { SubscriptionStatus } from '@/shared/domain/entities/billing-subscription'
import { PortalAppNotFoundError } from '../domain/errors/portal-domain.errors'
import Stripe from 'stripe'
import { randomUUID } from 'crypto'

export type CreateTrialSubscriptionForAppInput = {
  appId: string
  trialDays: number
}

export type CreateTrialSubscriptionForAppOutput = {
  id: string
  status: string
  trialEndsAt: Date
}

async function resolveStripeCustomer(
  stripe: Stripe,
  appId: string,
  appEmail: string,
): Promise<string> {
  const existing = await prisma.billingSubscription.findFirst({
    where: { appId },
    orderBy: { createdAt: 'desc' },
  })

  if (existing?.stripeSubscriptionId) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(
        existing.stripeSubscriptionId,
      )
      return stripeSub.customer as string
    } catch {
      // fall through to create new customer
    }
  }

  const customer = await stripe.customers.create({
    email: appEmail,
    metadata: { appId },
  })
  return customer.id
}

export async function createTrialSubscriptionForApp(
  input: CreateTrialSubscriptionForAppInput,
): Promise<CreateTrialSubscriptionForAppOutput> {
  if (input.trialDays < 1) {
    throw new Error('trialDays must be at least 1')
  }

  const app = await prisma.app.findUnique({ where: { id: input.appId } })
  if (!app) throw new PortalAppNotFoundError()

  const stripe = new Stripe(env.stripe.secretKey)
  const customerId = await resolveStripeCustomer(stripe, input.appId, app.email)

  const stripeSub = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: env.thinkzapStripePriceId, quantity: 1 }],
    trial_period_days: input.trialDays,
    metadata: { appId: input.appId, quantity: 1 },
    trial_settings: {
      end_behavior: { missing_payment_method: 'create_invoice' },
    },
  })

  const sub = await prisma.billingSubscription.create({
    data: {
      id: randomUUID(),
      appId: input.appId,
      status: SubscriptionStatus.TRIALING,
      stripeSubscriptionId: stripeSub.id,
      connectorQuantity: 1,
      trialEndsAt: new Date((stripeSub.trial_end ?? 0) * 1000),
    },
  })

  return {
    id: sub.id,
    status: sub.status,
    trialEndsAt: sub.trialEndsAt!,
  }
}
