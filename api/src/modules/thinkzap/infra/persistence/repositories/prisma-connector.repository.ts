import { randomUUID } from 'node:crypto'
import {
  Connector,
  ConnectorProvider,
} from '@/modules/thinkzap/domain/entities/connector'
import {
  CreateConnectorInput,
  CreateConnectorRepository,
} from '@/modules/thinkzap/domain/repositories/create-connector.repository'
import { prisma } from '@/config/prisma.js'
import { ListConnectorsRepository } from '@/modules/thinkzap/domain/repositories/list-connectors'
import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { UpdateConnectorRepository } from '@/modules/thinkzap/domain/repositories/update-connector.repository'

export class PrismaConnectorRepository
  implements
    CreateConnectorRepository,
    ListConnectorsRepository,
    GetConnectorRepository,
    UpdateConnectorRepository
{
  constructor() {}

  async createConnector(connector: CreateConnectorInput): Promise<void> {
    await prisma.connector.create({
      data: {
        id: randomUUID(),
        instanceId: connector.instanceId,
        appId: connector.appId,
        provider: connector.provider ?? ConnectorProvider.ZAPI,
      },
    })
  }

  async get(id: string): Promise<Connector | null> {
    const connector = await prisma.connector.findUnique({
      where: { id: id },
    })
    if (!connector) return null

    return {
      id: connector.id,
      instanceId: connector.instanceId,
      appId: connector.appId,
      provider: connector.provider as ConnectorProvider,
      createdAt: connector.createdAt,
      updatedAt: connector.updatedAt,
    } as Connector
  }

  async getConnectorByInstanceId(
    instanceId: string,
  ): Promise<Connector | null> {
    const connector = await prisma.connector.findUnique({
      where: { instanceId: instanceId },
    })
    if (!connector) return null
    return {
      id: connector.id,
      instanceId: connector.instanceId,
      appId: connector.appId,
      provider: connector.provider as ConnectorProvider,
    } as Connector
  }

  async listConnectors(
    appId: string,
    includeZapiToken: boolean = false,
  ): Promise<Connector[]> {
    const connectors = await prisma.connector.findMany({
      where: {
        appId: appId,
        status: {
          not: 'INACTIVE',
        },
      },
      include: {
        instance: true,
      },
    })

    return connectors.map(
      el =>
        ({
          id: el.id,
          appId: el.appId,
          instanceId: el.instanceId,
          provider: el.provider as ConnectorProvider,
          instance: el.instance
            ? {
                id: el.instance.id,
                domainId: el.instance.domainId,
                instanceId: el.instance.instanceId,
                vinculatedChannel: el.instance.vinculatedChannel,
                channelId: el.instance.channelId,
                webhookId: el.instance.webhookId,
                wabaId: el.instance.wabaId,
                phoneId: el.instance.phoneId,
                settings: el.instance.settings,
                zApiToken: includeZapiToken ? el.instance.zApiToken : undefined,
              }
            : undefined,
          createdAt: el.createdAt,
          updatedAt: el.updatedAt,
        }) as Connector,
    )
  }

  async markAsInactive(connectorId: string): Promise<void> {
    await prisma.connector.update({
      where: { id: connectorId },
      data: {
        status: 'INACTIVE',
      },
    })
  }
}
