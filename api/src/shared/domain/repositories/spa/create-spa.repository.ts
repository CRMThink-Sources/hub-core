import { Spa } from '@/shared/domain/entities/spa'

export type CreateSpaParams = Omit<
  Spa,
  'id' | 'trialExpiresAt' | 'trialCustomerId' | 'trialSubscriptionId'
> & {
  trialExpiresAt?: string | null
  trialCustomerId?: string | null
  trialSubscriptionId?: string | null
  status?: string | null
}

export interface CreateSpaRepository {
  create(params: CreateSpaParams): Promise<Spa>
}
