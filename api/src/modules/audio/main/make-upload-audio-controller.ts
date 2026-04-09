import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { Controller } from '@/shared/presentation/controller'
import { UploadAudioController } from '../presentation/controllers/upload-audio.controller'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { PrismaAvailableAppRepository } from '@/shared/infra/persistence/repositories/prisma-available-app.repository'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'

export const makeUploadAudioController = (): Controller => {
  const domainRepository = new PrismaDomainRepository()
  const availableAppRepository = new PrismaAvailableAppRepository()
  const installedAppRepository = new PrismaInstalledAppRepository()
  const credentialRepository = new PrismaCredentialRepository()
  return new UploadAudioController(
    domainRepository,
    availableAppRepository,
    installedAppRepository,
    credentialRepository,
  )
}
