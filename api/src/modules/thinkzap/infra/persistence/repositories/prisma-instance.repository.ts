import {
  CreateInstanceInput,
  CreateInstanceRepository,
} from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma.js'
import {
  Instance,
  InstanceStatus,
} from '@/modules/thinkzap/domain/entities/instance'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { UpdateInstanceRepository } from '@/modules/thinkzap/domain/repositories/update-instance.repository'
import { toInstance } from '../mappers/instance.mapper'

export class PrismaInstanceRepository
  implements
    CreateInstanceRepository,
    GetInstanceRepository,
    UpdateInstanceRepository
{
  /**
   * Campo provider-specific ausente é **omitido** do `INSERT`, não enviado como
   * `null` — mesma convenção do mapper de item da SPA, onde campo ausente no input
   * nunca vira escrita.
   *
   * O efeito prático é tolerar deploy que chegue antes da migration: as colunas
   * `channel_id`, `webhook_id`, `waba_id` e `phone_id` vêm de
   * `20260709191216_add_connector_provider_and_hubmessage_fields`, e mandar `null`
   * explícito as inclui no `INSERT` — num ambiente ainda sem elas, o banco responde
   * `P2022 ColumnNotFound` e a criação de linha Z-API falha por causa de campos que
   * ela não usa. Omitindo, funciona nos dois schemas.
   */
  async create(instance: CreateInstanceInput): Promise<Instance> {
    const newInstance = await prisma.instance.create({
      data: {
        id: randomUUID(),
        domainId: instance.domainId,
        instanceId: instance.instanceId,
        vinculatedChannel: instance.vinculatedChannel,
        zApiToken: instance.zApiToken,
        ...(instance.channelId != null
          ? { channelId: instance.channelId }
          : {}),
        ...(instance.webhookId != null
          ? { webhookId: instance.webhookId }
          : {}),
        ...(instance.wabaId != null ? { wabaId: instance.wabaId } : {}),
        ...(instance.phoneId != null ? { phoneId: instance.phoneId } : {}),
        /**
         * `settings` **não** entra no `INSERT`: a coluna está deprecada e o
         * `@default("{}")` do schema cobre o `NOT NULL`. `parseConnectorSettings`
         * colapsa `{}` em `DEFAULT_CONNECTOR_SETTINGS` na leitura, então a row
         * nasce igual ao que a escrita explícita produzia — sem escrever nada.
         */
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

  async getInstanceByChannelId(channelId: string): Promise<Instance | null> {
    const instance = await prisma.instance.findFirst({
      where: { channelId },
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

  async markAsConnected(
    instanceId: string,
    data: { wabaId: string; phoneId: string; webhookId?: string | null },
  ): Promise<Instance> {
    const updatedInstance = await prisma.instance.update({
      where: { id: instanceId },
      data: {
        status: InstanceStatus.CONNECTED,
        wabaId: data.wabaId,
        phoneId: data.phoneId,
        ...(data.webhookId ? { webhookId: data.webhookId } : {}),
      },
    })

    return toInstance(updatedInstance)
  }
}
