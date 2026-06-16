import { prisma } from '@/config/prisma'
import { PortalAppNotFoundError } from '../domain/errors/portal-domain.errors'

export type AppSubscriptionItem = {
  id: string
  status: string
  stripeSubscriptionId: string
  connectorQuantity: number
  trialEndsAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type ListSubscriptionsForAppOutput = {
  subscriptions: AppSubscriptionItem[]
}

export async function listSubscriptionsForApp(
  appId: string,
): Promise<ListSubscriptionsForAppOutput> {
  const app = await prisma.app.findUnique({ where: { id: appId } })

  if (!app) {
    throw new PortalAppNotFoundError()
  }

  const subscriptions = await prisma.billingSubscription.findMany({
    where: { appId },
    orderBy: { createdAt: 'desc' },
  })

  return {
    subscriptions: subscriptions.map(s => ({
      id: s.id,
      status: s.status,
      stripeSubscriptionId: s.stripeSubscriptionId,
      connectorQuantity: s.connectorQuantity,
      trialEndsAt: s.trialEndsAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
  }
}
