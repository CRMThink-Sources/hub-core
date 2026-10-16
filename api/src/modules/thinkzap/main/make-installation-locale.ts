import type { InstallationLocaleRepository } from '@/modules/thinkzap/domain/ports/installation-locale.port'
import { PrismaInstallationLocaleRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-installation-locale.repository'
import { SaveInstallationLocaleController } from '@/modules/thinkzap/presentation/controllers/save-installation-locale.controller'
import { Controller } from '@/shared/presentation/controller'

export function makeInstallationLocaleRepository(): InstallationLocaleRepository {
  return new PrismaInstallationLocaleRepository()
}

export const makeSaveInstallationLocaleController = (): Controller =>
  new SaveInstallationLocaleController(makeInstallationLocaleRepository())
