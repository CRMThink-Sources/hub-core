import { CreateInstanceRepository } from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma.js'
import {
  Instance,
  InstanceStatus,
} from '@/modules/thinkzap/domain/entities/instance'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { UpdateInstanceRepository } from '@/modules/thinkzap/domain/repositories/update-instance.repository'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { toInstance } from '../mappers/instance.mapper'

export class PrismaInstanceRepository
  implements
    CreateInstanceRepository,
    GetInstanceRepository,
    UpdateInstanceRepository
{
  async create(
    instance: Omit<Instance, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Instance> {
    const newInstance = await prisma.instance.create({
      data: {
        id: randomUUID(),
        domainId: instance.domainId,
        instanceId: instance.instanceId,
        vinculatedChannel: instance.vinculatedChannel,
        zApiToken: instance.zApiToken,
        settings: instance.settings,
        status: instance.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    return toInstance(newInstance)
  }

  async getInstanceByInstanceId(instanceId: string): Promise<Instance | null> {
    const instance = await prisma.instance.findFirst({
      where: { instanceId },
    })
    if (!instance) return null
    return toInstance(instance)
  }

  async getInstance(instanceId: string): Promise<Instance | null> {
    const instance = await prisma.instance.findUnique({
      where: { id: instanceId },
    })
    if (!instance) return null

    return toInstance(instance)
  }

  async getByDomainIdAndVinculatedChannel(
    domainId: string,
    vinculatedChannel: string,
  ): Promise<Instance | null> {
    const instance = await prisma.instance.findFirst({
      where: { domainId, vinculatedChannel },
    })
    if (!instance) return null
    return toInstance(instance)
  }

  async updateVinculatedChannel(
    instanceId: string,
    channelId: string,
  ): Promise<Instance> {
    const updatedInstance = await prisma.instance.update({
      where: { id: instanceId },
      data: {
        vinculatedChannel: channelId,
      },
    })
    return toInstance(updatedInstance)
  }

  async updateSettings(
    instanceId: string,
    settings: ConnectorSettings,
  ): Promise<Instance> {
    const updatedInstance = await prisma.instance.update({
      where: { id: instanceId },
      data: {
        settings,
      },
    })
    return toInstance(updatedInstance)
  }

  async markAsDisconnected(instanceId: string): Promise<Instance> {
    const updatedInstance = await prisma.instance.update({
      where: { id: instanceId },
      data: {
        status: InstanceStatus.DISCONNECTED,
        vinculatedChannel: null,
      },
    })

    return toInstance(updatedInstance)
  }
}
