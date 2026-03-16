import { AvailableApp } from '@/shared/domain/entities/available-app'

export interface GetAvailableAppRepository {
  getById(id: string): Promise<AvailableApp>
  getAvailableApp(appCode: string): Promise<AvailableApp>
}
