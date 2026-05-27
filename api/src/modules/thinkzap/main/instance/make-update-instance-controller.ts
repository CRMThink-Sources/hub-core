import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { ZApiInstanceGateway } from '../../infra/persistence/gateway/instance.gateway'
import { ZApiClient } from '../../infra/clients/z-api.client'
import { env } from '@/config/env'
import { PrismaConnectorRepository } from '../../infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstanceRepository } from '../../infra/persistence/repositories/prisma-instance.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { UpdateInstanceController } from '../../presentation/controllers/instance/update-instance.controller'
import { UpdateInstanceSettingsUseCase } from '../../application/update-instance-settings.use-case'

export const makeUpdateInstanceController = (
  _req: Request,
): Promise<Controller> => {
  const zApi = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)
  const zApiInstanceGateway = new ZApiInstanceGateway(zApi)
  const getConnectorRepository = new PrismaConnectorRepository()
  const getInstanceRepository = new PrismaInstanceRepository()
  const getDomainRepository = new PrismaDomainRepository()
  const updateInstanceRepository = new PrismaInstanceRepository()

  const updateInstanceSettings = new UpdateInstanceSettingsUseCase(
    getConnectorRepository,
    getInstanceRepository,
    getDomainRepository,
    zApiInstanceGateway,
    updateInstanceRepository,
  )

  return Promise.resolve(new UpdateInstanceController(updateInstanceSettings))
}
