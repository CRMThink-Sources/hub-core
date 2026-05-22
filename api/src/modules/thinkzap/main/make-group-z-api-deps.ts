import { env } from '@/config/env'
import { ZApiClient } from '../infra/clients/z-api.client'
import { PrismaConnectorRepository } from '../infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstanceRepository } from '../infra/persistence/repositories/prisma-instance.repository'

export function makeGroupZApiDeps() {
  return {
    connectorRepository: new PrismaConnectorRepository(),
    instanceRepository: new PrismaInstanceRepository(),
    zApiClient: new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken),
  }
}
