import { InstalledApp } from '@/shared/domain/entities/installed-app'
import {
  UpsertInstalledAppParams,
  UpsertInstalledAppRepository,
} from '@/shared/domain/repositories/instaled-app/upsert-installed-app.repository'

export type UpsertInstalledAppInput = UpsertInstalledAppParams

/**
 * Passo `upsert-app` da instalação. Substitui o `GetOrCreateInstalledApp`, que
 * não atualizava `email` nem reativava app com `status` diferente de `ACTIVE`.
 */
export class UpsertInstalledApp {
  constructor(
    private readonly installedAppRepository: UpsertInstalledAppRepository,
  ) {}

  async execute(input: UpsertInstalledAppInput): Promise<InstalledApp> {
    return this.installedAppRepository.upsert(input)
  }
}
