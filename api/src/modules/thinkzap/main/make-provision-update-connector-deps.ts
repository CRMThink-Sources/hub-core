import { env } from '@/config/env'
import type { ProvisionUpdateConnectorsDeps } from '../application/provision-update-connectors'
import { PrismaConnectorRepository } from '../infra/persistence/repositories/prisma-connector.repository'
import { ZApiClient } from '../infra/clients/z-api.client'
import { ZApiInstanceGateway } from '../infra/persistence/gateway/instance.gateway'
import { PrismaInstanceRepository } from '../infra/persistence/repositories/prisma-instance.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'

export function makeProvisionUpdateConnectorDeps(): ProvisionUpdateConnectorsDeps {
  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)
  const connectorRepo = new PrismaConnectorRepository()
  const instanceRepo = new PrismaInstanceRepository()
  const updateInstanceGateway = new ZApiInstanceGateway(zApiClient)
  // env.thinkzapMockZApiProvisioning
  //   ? new MockZApiInstanceGateway()
  // : new ZApiInstanceGateway(zApiClient)

  return {
    getApp: new PrismaInstalledAppRepository(),
    listConnectors: connectorRepo,
    getInstanceRepo: instanceRepo,
    updateInstanceRepo: instanceRepo,
    updateConnectorRepo: connectorRepo,
    updateInstanceGateway,
  }
}
