import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { UpdateInstanceController } from '../../presentation/controllers/instance/update-instance.controller'
import { ZApiInstanceGateway } from '../../infra/persistence/gateway/instance.gateway'
import { ZApiClient } from '../../infra/clients/z-api.client'
import { env } from '@/config/env'
import { PrismaConnectorRepository } from '../../infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstanceRepository } from '../../infra/persistence/repositories/prisma-instance.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'

export const makeUpdateInstanceController = async (
  req: Request,
): Promise<Controller> => {
  const bx = await makeBitrixClient(req)
  const zApi = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)
  const zApiInstanceGateway = new ZApiInstanceGateway(zApi)
  const getConnectorRepository = new PrismaConnectorRepository()
  const getInstanceRepository = new PrismaInstanceRepository()
  const getDomainRepository = new PrismaDomainRepository()
  return new UpdateInstanceController(
    bx,
    zApiInstanceGateway,
    getConnectorRepository,
    getInstanceRepository,
    getDomainRepository,
  )
}
