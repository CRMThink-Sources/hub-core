export type BillingSubscription = {
  id: string
  appId: string
  status: SubscriptionStatus
  stripeSubscriptionId: string
  connectorQuantity: number
  trialEndsAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  PAST_DUE = 'PAST_DUE',
  TRIALING = 'TRIALING',
  INCOMPLETE = 'INCOMPLETE',
  INCOMPLETE_EXPIRED = 'INCOMPLETE_EXPIRED',
}

export function fromStripeStatus(stripeStatus: string): SubscriptionStatus {
  const map: Record<string, SubscriptionStatus> = {
    active: SubscriptionStatus.ACTIVE,
    trialing: SubscriptionStatus.TRIALING,
    past_due: SubscriptionStatus.PAST_DUE,
    canceled: SubscriptionStatus.CANCELLED,
    incomplete: SubscriptionStatus.INCOMPLETE,
    incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
  }
  return map[stripeStatus] ?? SubscriptionStatus.INCOMPLETE
}

/** Permite aumentar quantidade na assinatura existente (Stripe + banco). Trial exige efetivar antes. */
export function canAdjustSubscriptionQuantity(
  status: SubscriptionStatus,
): boolean {
  return (
    status === SubscriptionStatus.ACTIVE ||
    status === SubscriptionStatus.PAST_DUE
  )
}
