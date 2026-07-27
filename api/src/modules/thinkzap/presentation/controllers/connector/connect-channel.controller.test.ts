/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { Request, Response } from 'express'

import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { InstanceStatus } from '@/modules/thinkzap/domain/entities/instance'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { UpdateInstanceRepository } from '@/modules/thinkzap/domain/repositories/update-instance.repository'
import { ConnectChannelController } from './connect-channel.controller'

const WEBHOOK_URL = 'https://app.example/webhooks/hubmessage'

const instance: {
  id: string
  instanceId: string
  channelId: string
  webhookId: string | null
  status: InstanceStatus
} = {
  id: 'instance-db-1',
  instanceId: 'chan_1',
  channelId: 'chan_1',
  webhookId: null,
  status: InstanceStatus.CONNECTING,
}

function makeDeps(overrides?: {
  client?: Partial<HubMessageClient>
  instance?: Partial<typeof instance>
}) {
  const client = {
    connectChannel: vi.fn().mockResolvedValue(undefined),
    createWebhook: vi.fn().mockResolvedValue({ id: 'wh_1' }),
    ...overrides?.client,
  } as unknown as HubMessageClient

  const getConnectorRepository = {
    get: vi.fn().mockResolvedValue({
      id: 'conn-1',
      instanceId: 'instance-db-1',
      provider: ConnectorProvider.HUBMESSAGE,
    }),
  } as unknown as GetConnectorRepository

  const instanceRepository = {
    getInstance: vi
      .fn()
      .mockResolvedValue({ ...instance, ...overrides?.instance }),
    markAsConnected: vi.fn().mockResolvedValue(undefined),
  } as unknown as GetInstanceRepository & UpdateInstanceRepository

  const controller = new ConnectChannelController(
    client,
    getConnectorRepository,
    instanceRepository,
    WEBHOOK_URL,
  )

  return { client, getConnectorRepository, instanceRepository, controller }
}

const req = {
  body: {
    connectorId: 'conn-1',
    wabaId: 'waba-1',
    phoneId: 'phone-1',
    code: 'code-1',
  },
} as Request

const res = {} as Response

describe('ConnectChannelController', () => {
  it('conecta o canal e persiste wabaId/phoneId', async () => {
    const { client, instanceRepository, controller } = makeDeps()

    const result = await controller.perform(req, res)

    expect(client.connectChannel).toHaveBeenCalledWith('chan_1', {
      wabaId: 'waba-1',
      phoneId: 'phone-1',
      code: 'code-1',
      coexistence: false,
    })
    expect(instanceRepository.markAsConnected).toHaveBeenCalledWith(
      'instance-db-1',
      { wabaId: 'waba-1', phoneId: 'phone-1', webhookId: 'wh_1' },
    )
    expect(result.status).toBe(200)
  })

  it('cria o webhook quando a instância ainda não tem um', async () => {
    const { client, controller } = makeDeps()

    await controller.perform(req, res)

    expect(client.createWebhook).toHaveBeenCalledWith('chan_1', {
      url: WEBHOOK_URL,
      events: ['MESSAGE_RECEIVED'],
    })
  })

  it('não recria o webhook quando a instância já tem um', async () => {
    const { client, instanceRepository, controller } = makeDeps({
      instance: { webhookId: 'wh_existing' },
    })

    await controller.perform(req, res)

    expect(client.createWebhook).not.toHaveBeenCalled()
    expect(instanceRepository.markAsConnected).toHaveBeenCalledWith(
      'instance-db-1',
      { wabaId: 'waba-1', phoneId: 'phone-1', webhookId: null },
    )
  })

  it('falha do webhook não derruba a conexão', async () => {
    const { instanceRepository, controller } = makeDeps({
      client: {
        createWebhook: vi.fn().mockRejectedValue(new Error('boom')),
      } as Partial<HubMessageClient>,
    })

    const result = await controller.perform(req, res)

    expect(result.status).toBe(200)
    expect(instanceRepository.markAsConnected).toHaveBeenCalledWith(
      'instance-db-1',
      { wabaId: 'waba-1', phoneId: 'phone-1', webhookId: null },
    )
  })

  it('rejeita conector que não é HubMessage', async () => {
    const { client, controller, getConnectorRepository } = makeDeps()
    vi.mocked(getConnectorRepository.get).mockResolvedValue({
      id: 'conn-1',
      instanceId: 'instance-db-1',
      provider: ConnectorProvider.ZAPI,
    } as Awaited<ReturnType<GetConnectorRepository['get']>>)

    const result = await controller.perform(req, res)

    expect(result.status).toBe(400)
    expect(client.connectChannel).not.toHaveBeenCalled()
  })
})
