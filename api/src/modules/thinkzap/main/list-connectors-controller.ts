import { Controller } from '@/shared/presentation/controller'
import { ListConnectorsController } from '../presentation/controllers/list-connectors.controller'
import { PrismaConnectorRepository } from '../infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'

export const makeListConnectorsController = (): Controller => {
  const getInstalledAppRepository = new PrismaInstalledAppRepository()
  const listConnectorsRepository = new PrismaConnectorRepository()

  return new ListConnectorsController(
    listConnectorsRepository,
    getInstalledAppRepository,
  )
}
