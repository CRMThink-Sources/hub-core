import { CreateInstanceRepository } from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma.js'
import {
  Instance,
  InstanceStatus,
} from '@/modules/thinkzap/domain/entities/instance'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { UpdateInstanceRepository } from '@/modules/thinkzap/domain/repositories/update-instance.repository'

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
        status: instance.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    return {
      id: newInstance.id,
      domainId: newInstance.domainId,
      instanceId: newInstance.instanceId,
      vinculatedChannel: newInstance.vinculatedChannel,
      zApiToken: newInstance.zApiToken,
      status: newInstance.status as InstanceStatus,
      phoneNumber: null,
      createdAt: newInstance.createdAt,
      updatedAt: newInstance.updatedAt,
    }
  }

  async getInstanceByInstanceId(instanceId: string): Promise<Instance | null> {
    const instance = await prisma.instance.findFirst({
      where: { instanceId },
    })
    if (!instance) return null
    return {
      id: instance.id,
      domainId: instance.domainId,
      instanceId: instance.instanceId,
      vinculatedChannel: instance.vinculatedChannel,
      zApiToken: instance.zApiToken,
      status: instance.status as InstanceStatus,
      phoneNumber: null,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
    } as Instance
  }

  async getInstance(instanceId: string): Promise<Instance | null> {
    const instance = await prisma.instance.findUnique({
      where: { id: instanceId },
    })
    if (!instance) return null

    return {
      id: instance.id,
      domainId: instance.domainId,
      instanceId: instance.instanceId,
      vinculatedChannel: instance.vinculatedChannel,
      zApiToken: instance.zApiToken,
      status: instance.status as InstanceStatus,
      phoneNumber: null,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
    }
  }

  async getByDomainIdAndVinculatedChannel(
    domainId: string,
    vinculatedChannel: string,
  ): Promise<Instance | null> {
    const instance = await prisma.instance.findFirst({
      where: { domainId, vinculatedChannel },
    })
    if (!instance) return null
    return {
      id: instance.id,
      domainId: instance.domainId,
      instanceId: instance.instanceId,
      vinculatedChannel: instance.vinculatedChannel,
      zApiToken: instance.zApiToken,
      status: instance.status as InstanceStatus,
      phoneNumber: null,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
    }
  }

  async update(
    instance: Omit<Instance, 'createdAt' | 'updatedAt'>,
  ): Promise<Instance> {
    const updatedInstance = await prisma.instance.update({
      where: { id: instance.id },
      data: instance,
    })
    return {
      id: updatedInstance.id,
      domainId: updatedInstance.domainId,
      instanceId: updatedInstance.instanceId,
      vinculatedChannel: updatedInstance.vinculatedChannel,
      zApiToken: updatedInstance.zApiToken,
      status: updatedInstance.status as InstanceStatus,
      phoneNumber: null,
      createdAt: updatedInstance.createdAt,
    } as Instance
  }
}
