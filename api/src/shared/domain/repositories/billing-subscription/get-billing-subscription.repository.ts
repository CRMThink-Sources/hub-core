import type { BillingSubscription } from '@/shared/domain/entities/billing-subscription'

export interface GetBillingSubscriptionRepository {
  getByAppId(appId: string): Promise<BillingSubscription | null>
  getByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<BillingSubscription | null>
}
