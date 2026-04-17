import { env } from '@/config/env'
import type { ProvisionMissingConnectorsDeps } from '../application/provision-missing-connectors'
import { PrismaConnectorRepository } from '../infra/persistence/repositories/prisma-connector.repository'
import { ZApiClient } from '../infra/clients/z-api.client'
import { ZApiInstanceGateway } from '../infra/persistence/gateway/instance.gateway'
import { MockZApiInstanceGateway } from '../infra/persistence/gateway/mock-instance.gateway'
import { PrismaInstanceRepository } from '../infra/persistence/repositories/prisma-instance.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'

export function makeProvisionMissingConnectorsDeps(): ProvisionMissingConnectorsDeps {
  const zApiClient = new ZApiClient(env.zApi.partnerToken)
  const connectorRepo = new PrismaConnectorRepository()
  const instanceGateway = env.thinkzapMockZApiProvisioning
    ? new MockZApiInstanceGateway()
    : new ZApiInstanceGateway(zApiClient)

  if (env.thinkzapMockZApiProvisioning) {
    console.warn(
      '[thinkzap] provisionamento em modo MOCK (sem criar instâncias reais na Z-API)',
    )
  }

  return {
    createConnectorRepo: connectorRepo,
    listConnectors: connectorRepo,
    instanceGateway,
    createInstanceRepo: new PrismaInstanceRepository(),
    getApp: new PrismaInstalledAppRepository(),
    getDomainRepository: new PrismaDomainRepository(),
  }
}
