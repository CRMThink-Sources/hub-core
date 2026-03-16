import { Controller } from "@/shared/presentation/controller";
import { InstallController } from "@/modules/auth/presentation/controllers/install-controller";
import { GetOrCreateDomain } from "@/shared/application/get-or-create-domain";
import { PrismaAvailableAppRepository } from "@/shared/infra/persistence/repositories/prisma-available-app.repository";
import { PrismaDomainRepository } from "@/shared/infra/persistence/repositories/prisma-domain.repository";
import { GetOrCreateInstalledApp } from "@/shared/application/get-or-create-installed-app";
import { PrismaInstalledAppRepository } from "@/shared/infra/persistence/repositories/prisma-installed-app.repository";
import { PrismaCredentialRepository } from "@/shared/infra/persistence/repositories/prisma-credential.repository";
import { GetOrCreateCredential } from "@/shared/application/get-or-create-credential";

export const createInstallController = (): Controller => {
  const getAvailableAppRepository = new PrismaAvailableAppRepository();
  const domainRepository = new PrismaDomainRepository();
  const getOrCreateDomain = new GetOrCreateDomain(domainRepository, domainRepository);
  const installedAppRepository = new PrismaInstalledAppRepository();
  const getOrCreateInstalledApp = new GetOrCreateInstalledApp(installedAppRepository);
  const credentialRepository = new PrismaCredentialRepository();
  const getOrCreateCredential = new GetOrCreateCredential(credentialRepository);

  return new InstallController(getAvailableAppRepository, getOrCreateDomain, getOrCreateInstalledApp, getOrCreateCredential);
};