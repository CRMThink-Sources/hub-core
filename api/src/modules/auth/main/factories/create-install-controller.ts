import { Controller } from '@/shared/presentation/controller'
import { InstallController } from '@/modules/auth/presentation/controllers/install-controller'
import { InstallApp } from '@/shared/application/install-app'
import { UpsertDomain } from '@/shared/application/upsert-domain'
import { UpsertInstalledApp } from '@/shared/application/upsert-installed-app'
import { UpsertCredential } from '@/shared/application/upsert-credential'
import { GetOrCreateSpa } from '@/shared/application/get-or-create-spa'
import { PrismaAvailableAppRepository } from '@/shared/infra/persistence/repositories/prisma-available-app.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { BitrixSpaRepository } from '@/shared/infra/persistence/repositories/bitrix-spa.repository'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { appInstallerRegistry } from '@/shared/infra/setup-app-installers'
import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { PrismaAplicationRepository } from '@/modules/application/infra/prisma/repositories/prisma-aplications.repository'
import { BitrixAplicationTitleReader } from '@/modules/application/infra/bitrix/readers/bitrix-aplication-title.reader'

export const createInstallController = (): Controller => {
  const domainRepository = new PrismaDomainRepository()
  const installedAppRepository = new PrismaInstalledAppRepository()
  const credentialRepository = new PrismaCredentialRepository()

  // Portal **interno** da CRMThink: é onde vive a SPA 1060 e de onde sai o
  // título do item espelho. O portal do cliente é acessado pelo installer, com
  // o `access_token` da instalação.
  const bitrixClient = new BitrixClient({ webhook: env.crmthinkWebhookUrl })

  const aplicationRepository = new PrismaAplicationRepository(
    prisma,
    new BitrixAplicationTitleReader(bitrixClient),
  )

  const installApp = new InstallApp(
    new PrismaAvailableAppRepository(),
    new UpsertDomain(domainRepository),
    new UpsertInstalledApp(installedAppRepository),
    new UpsertCredential(credentialRepository),
    new GetOrCreateSpa(new BitrixSpaRepository(bitrixClient)),
    aplicationRepository,
    appInstallerRegistry,
  )

  return new InstallController(installApp)
}
