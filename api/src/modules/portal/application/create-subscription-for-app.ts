import { env } from '@/config/env'
import { prisma } from '@/config/prisma'
import { SubscriptionStatus } from '@/shared/domain/entities/billing-subscription'
import { PortalAppNotFoundError } from '../domain/errors/portal-domain.errors'
import Stripe from 'stripe'
import { randomUUID } from 'crypto'

export type CreateSubscriptionForAppInput = {
  appId: string
  connectorQuantity: number
}

export type CreateSubscriptionForAppOutput = {
  id: string
  status: string
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
      // fall through
    }
  }

  const customer = await stripe.customers.create({
    email: appEmail,
    metadata: { appId },
  })
  return customer.id
}

export async function createSubscriptionForApp(
  input: CreateSubscriptionForAppInput,
): Promise<CreateSubscriptionForAppOutput> {
  const app = await prisma.app.findUnique({ where: { id: input.appId } })
  if (!app) throw new PortalAppNotFoundError()

  const stripe = new Stripe(env.stripe.secretKey)
  const customerId = await resolveStripeCustomer(stripe, input.appId, app.email)

  const stripeSub = await stripe.subscriptions.create({
    customer: customerId,
    items: [
      { price: env.thinkzapStripePriceId, quantity: input.connectorQuantity },
    ],
    collection_method: 'send_invoice',
    days_until_due: 30,
    metadata: { appId: input.appId, quantity: input.connectorQuantity },
  })

  const sub = await prisma.billingSubscription.create({
    data: {
      id: randomUUID(),
      appId: input.appId,
      status: SubscriptionStatus.ACTIVE,
      stripeSubscriptionId: stripeSub.id,
      connectorQuantity: input.connectorQuantity,
      trialEndsAt: null,
    },
  })

  return { id: sub.id, status: sub.status }
}
