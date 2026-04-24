import { Spa } from '@/shared/domain/entities/spa'

export type UpdateSpaParams = Partial<
  Omit<Spa, 'id' | 'appId' | 'domain' | 'memberId'>
> & {
  appId: string
  domain: string
}

export interface UpdateSpaRepository {
  update(params: UpdateSpaParams): Promise<Spa>
}
