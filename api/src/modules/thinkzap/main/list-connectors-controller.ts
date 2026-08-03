import { Controller } from '@/shared/presentation/controller'
import { ListConnectorsController } from '../presentation/controllers/list-connectors.controller'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'

export const makeListConnectorsController = (): Controller =>
  new ListConnectorsController(
    new PrismaInstalledAppRepository(),
    makeGetAplicationContext(),
  )
