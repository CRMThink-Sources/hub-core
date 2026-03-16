import { Controller } from "@/shared/presentation/controller";
import { ListConnectorsController } from "../presentation/controllers/list-connectors.controller";
import { PrismaConnectorRepository } from "../infra/persistence/repositories/prisma-connector.repository";
import { GetOrCreateInstalledApp } from "@/shared/application/get-or-create-installed-app";
import { PrismaInstalledAppRepository } from "@/shared/infra/persistence/repositories/prisma-installed-app.repository";

export const makeListConnectorsController = (): Controller => {
  const getApp = new GetOrCreateInstalledApp(new PrismaInstalledAppRepository());
  const listConnectorsRepository = new PrismaConnectorRepository();
  return new ListConnectorsController(listConnectorsRepository, getApp);
}