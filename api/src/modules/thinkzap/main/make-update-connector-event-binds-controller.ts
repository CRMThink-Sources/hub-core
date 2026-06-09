import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { PrismaConnectorRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { UpdateConnectorEventBindsUseCase } from '@/modules/thinkzap/application/update-connector-event-binds.use-case'
import { UpdateConnectorEventBindsController } from '@/modules/thinkzap/presentation/controllers/update-connector-event-binds.controller'

export const makeUpdateConnectorEventBindsController = (
  _req: Request,
): Controller => {
  const getConnectorRepository = new PrismaConnectorRepository()
  const instanceRepository = new PrismaInstanceRepository()

  const useCase = new UpdateConnectorEventBindsUseCase(
    getConnectorRepository,
    instanceRepository,
    instanceRepository,
  )

  return new UpdateConnectorEventBindsController(useCase)
}
