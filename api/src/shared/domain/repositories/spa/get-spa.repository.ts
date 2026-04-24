import { Spa } from '@/shared/domain/entities/spa'

export interface GetSpaRepository {
  get(params: { appId: string; domain: string }): Promise<Spa | null>
}
