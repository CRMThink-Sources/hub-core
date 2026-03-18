import { InstalledApp } from '@/shared/domain/entities/installed-app'

export interface CreateInstalledAppRepository {
  create(installedApp: Omit<InstalledApp, 'id'>): Promise<InstalledApp>
}
