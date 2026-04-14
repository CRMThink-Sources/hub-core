import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { ListBiconnectorsController } from '../presentation/controllers/list-biconnectors.controller'
import { PrismaBiConnectorRepository } from '../infra/persistence/repositories/prisma-bi-connector.repository'

export const makeListBiconnectorsController = (_req: Request): Controller => {
  const repository = new PrismaBiConnectorRepository()
  return new ListBiconnectorsController(repository)
}
