export interface Subscription {
  id: string
  name: string
  status: 'active' | 'past_due' | 'cancelled' | 'trialing'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  customer: string
}
