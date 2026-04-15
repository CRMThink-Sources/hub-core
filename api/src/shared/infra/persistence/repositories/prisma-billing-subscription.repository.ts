import { prisma } from '@/config/prisma.js'
import type { CreateBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/create-billing-subscription.repository'
import type { GetBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/get-billing-subscription.repository'
import type { UpdateBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/update-billing-subscription.repository'
import {
  type BillingSubscription,
  SubscriptionStatus,
} from '@/shared/domain/entities/billing-subscription'
import { randomUUID } from 'crypto'

type PrismaRecord = {
  id: string
  appId: string
  status: string
  stripeSubscriptionId: string
  connectorQuantity: number
  trialEndsAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export class PrismaBillingSubscriptionRepository
  implements
    CreateBillingSubscriptionRepository,
    GetBillingSubscriptionRepository,
    UpdateBillingSubscriptionRepository
{
  async create(
    data: Omit<BillingSubscription, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BillingSubscription> {
    const record = await prisma.billingSubscription.create({
      data: {
        id: randomUUID(),
        appId: data.appId,
        status: data.status,
        stripeSubscriptionId: data.stripeSubscriptionId,
        connectorQuantity: data.connectorQuantity,
        trialEndsAt: data.trialEndsAt,
      },
    })
    return this.toEntity(record)
  }

  async getByAppId(appId: string): Promise<BillingSubscription | null> {
    const record = await prisma.billingSubscription.findFirst({
      where: { appId },
      orderBy: { createdAt: 'desc' },
    })
    return record ? this.toEntity(record) : null
  }

  async getByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<BillingSubscription | null> {
    const record = await prisma.billingSubscription.findUnique({
      where: { stripeSubscriptionId },
    })
    return record ? this.toEntity(record) : null
  }

  async syncFromStripe(
    stripeSubscriptionId: string,
    data: {
      status: SubscriptionStatus
      trialEndsAt: Date | null
      connectorQuantity: number
    },
  ): Promise<BillingSubscription> {
    const record = await prisma.billingSubscription.update({
      where: { stripeSubscriptionId },
      data: {
        status: data.status,
        trialEndsAt: data.trialEndsAt,
        connectorQuantity: data.connectorQuantity,
      },
    })
    return this.toEntity(record)
  }

  private toEntity(record: PrismaRecord): BillingSubscription {
    return {
      id: record.id,
      appId: record.appId,
      status: record.status as SubscriptionStatus,
      stripeSubscriptionId: record.stripeSubscriptionId,
      connectorQuantity: record.connectorQuantity,
      trialEndsAt: record.trialEndsAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}
