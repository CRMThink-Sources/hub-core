import type {
  BillingSubscription,
  SubscriptionStatus,
} from '@/shared/domain/entities/billing-subscription'

export interface UpdateBillingSubscriptionRepository {
  syncFromStripe(
    stripeSubscriptionId: string,
    data: {
      status: SubscriptionStatus
      trialEndsAt: Date | null
      connectorQuantity: number
    },
  ): Promise<BillingSubscription>
}
