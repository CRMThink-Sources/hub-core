import { Controller } from "@/shared/presentation/controller";
import { VinculateChannelController } from "../../presentation/controllers/vinculate-channel.controller";
import { BitrixClient } from "@/shared/infra/clients/bitrix.client";
import { PrismaConnectorRepository } from "../../infra/persistence/repositories/prisma-connector.repository";
import { Request } from "express";
import { PrismaDomainRepository } from "@/shared/infra/persistence/repositories/prisma-domain.repository";
import { PrismaCredentialRepository } from "@/shared/infra/persistence/repositories/prisma-credential.repository";
import { PrismaInstalledAppRepository } from "@/shared/infra/persistence/repositories/prisma-installed-app.repository";


export const makeVinculateChannelController = async (req: Request): Promise<Controller> => {
  const { domainId, appId } = req;

  if (!domainId || !appId) {
    throw new Error("Domain ID and app ID are required");
  }
  const getDomainRepo = new PrismaDomainRepository();
  const domain = await getDomainRepo.getDomainById(domainId);
  const getAppRepo = new PrismaInstalledAppRepository();
  const app = await getAppRepo.getByAppCodeAndDomainId(appId, domainId);

  if (!app) {
    throw new Error("App not found");
  }

  const credentialRepo = new PrismaCredentialRepository();
  const credential = await credentialRepo.get({ appId: app?.id });

  if (!domain || !credential) {
    throw new Error("Domain or credential not found");
  }

  const bitrixClient = new BitrixClient(credential, domain?.name);
  const getConnectorRepository = new PrismaConnectorRepository();

  return new VinculateChannelController(getConnectorRepository, bitrixClient);
}