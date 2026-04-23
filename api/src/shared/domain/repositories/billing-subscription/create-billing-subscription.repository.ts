import type { BillingSubscription } from '@/shared/domain/entities/billing-subscription'

export interface CreateBillingSubscriptionRepository {
  create(
    data: Omit<BillingSubscription, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BillingSubscription>
}
