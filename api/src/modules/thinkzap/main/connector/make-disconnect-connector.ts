import { env } from '@/config/env'
import { Controller } from '@/shared/presentation/controller'
import { ZApiClient } from '../../infra/clients/z-api.client'
import { PrismaConnectorRepository } from '../../infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstanceRepository } from '../../infra/persistence/repositories/prisma-instance.repository'
import { DisconnectConnectorController } from '../../presentation/controllers/connector/disconnect-connector.controller'

export const makeDisconnectConnectorController = (): Controller => {
  const getConnectorRepository = new PrismaConnectorRepository()
  const instanceRepository = new PrismaInstanceRepository()
  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)
  return new DisconnectConnectorController(
    getConnectorRepository,
    instanceRepository,
    zApiClient,
  )
}
