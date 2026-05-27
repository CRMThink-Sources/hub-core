import { randomUUID } from 'node:crypto'
import { Connector } from '@/modules/thinkzap/domain/entities/connector'
import { CreateConnectorRepository } from '@/modules/thinkzap/domain/repositories/create-connector.repository'
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

  async createConnector(connector: Omit<Connector, 'id'>): Promise<void> {
    await prisma.connector.create({
      data: {
        id: randomUUID(),
        instanceId: connector.instanceId,
        appId: connector.appId,
      },
    })
  }

  async get(id: string): Promise<Connector | null> {
    console.log('id:', id)
    const connector = await prisma.connector.findUnique({
      where: { id: id },
    })
    console.log('connector:', connector)
    if (!connector) return null

    return {
      id: connector.id,
      instanceId: connector.instanceId,
      appId: connector.appId,
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
          instance: el.instance
            ? {
                id: el.instance.id,
                domainId: el.instance.domainId,
                instanceId: el.instance.instanceId,
                vinculatedChannel: el.instance.vinculatedChannel,
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
