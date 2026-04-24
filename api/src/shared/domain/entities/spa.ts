export interface Spa {
  id: string
  appId: string
  domain: string
  memberId: string
  name: string
  email: string
  phone: string
  company: string
  trialExpiresAt?: string | null
  trialCustomerId?: string | null
  trialSubscriptionId?: string | null
  status?: string | null
}
