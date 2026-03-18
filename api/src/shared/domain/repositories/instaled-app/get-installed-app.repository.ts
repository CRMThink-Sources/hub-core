import { InstalledApp } from '@/shared/domain/entities/installed-app'

export interface GetInstalledAppRepository {
  getById(id: string): Promise<InstalledApp | null>
  getByDomainId(domainId: string): Promise<InstalledApp | null>
  getByAppCodeAndDomainId(
    appCodeId: string,
    domainId: string,
  ): Promise<InstalledApp | null>
}
