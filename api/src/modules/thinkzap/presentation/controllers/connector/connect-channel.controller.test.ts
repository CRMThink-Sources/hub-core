/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { Request, Response } from 'express'

import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { InstanceStatus } from '@/modules/thinkzap/domain/entities/instance'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { UpdateInstanceRepository } from '@/modules/thinkzap/domain/repositories/update-instance.repository'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { Subscription } from '@/modules/application/domain/entities/subscription'
import type { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { ConnectChannelController } from './connect-channel.controller'

const WEBHOOK_URL = 'https://app.example/webhooks/hubmessage'

/** Item HubMessage cujo canal é o mesmo que a instância resolve (`chan_1`). */
const hubItem: SubscriptionItem = {
  id: 'item-1',
  name: 'Linha oficial',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'HUBMESSAGE',
    hubmessageChannelId: 'chan_1',
    wabaId: 'waba-antigo',
  },
}

const DAY = 24 * 60 * 60 * 1000

/** Assinatura ativa por default; os casos de bloqueio sobrescrevem. */
const subscription = (
  overrides: Partial<Subscription> = {},
): Partial<Subscription> => ({
  id: 'sub-1',
  status: 'active',
  currentPeriodStart: new Date(Date.now() - DAY),
  currentPeriodEnd: new Date(Date.now() + DAY),
  ...overrides,
})

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
  /** `null` = instalação sem item correspondente ao canal. */
  items?: SubscriptionItem[]
  subscription?: Partial<Subscription>
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

  const getAplicationContext = {
    execute: vi.fn().mockResolvedValue({
      customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
      aplication: { id: 'installed-1', spaId: '42' },
      subscriptions: [
        {
          ...subscription(overrides?.subscription),
          items: overrides?.items ?? [hubItem],
        },
      ],
    }),
  }

  /**
   * É aqui que a WABA passa a existir para o produto: o provisionamento cria só o
   * canal, e o item da linha é a fonte que templates leem.
   */
  const updateSubscriptionItem = vi.fn().mockResolvedValue(hubItem)
  const items = {
    getSubscriptionItem: vi.fn(),
    getSubscriptionItems: vi.fn(),
    getSubscriptionItemsBySubscription: vi.fn(),
    createSubscriptionItem: vi.fn(),
    updateSubscriptionItem,
    reparentSubscriptionItem: vi.fn(),
  } as unknown as SubscriptionItemRepository

  const controller = new ConnectChannelController(
    client,
    getConnectorRepository,
    instanceRepository,
    WEBHOOK_URL,
    getAplicationContext as never,
    items,
  )

  return {
    client,
    updateSubscriptionItem,
    getConnectorRepository,
    instanceRepository,
    getAplicationContext,
    controller,
  }
}

const req = {
  body: {
    connectorId: 'conn-1',
    wabaId: 'waba-1',
    phoneId: 'phone-1',
    code: 'code-1',
  },
  domainId: 'domain-1',
  appId: 'crmthink.thinkzap',
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
      events: [
        'MESSAGE_RECEIVED',
        'MESSAGE_DELIVERY',
        'CONNECTED',
        'DISCONNECTED',
      ],
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

  /**
   * Conectar é abrir sessão, então é o par oficial do QR code e recusa igual: sem
   * isto o cliente de trial vencido reconecta o número e a linha volta a funcionar
   * por fora do bloqueio.
   */
  describe('linha bloqueada', () => {
    it('recusa trial vencido sem tocar a HubMessage', async () => {
      const { client, instanceRepository, controller } = makeDeps({
        subscription: {
          status: 'trialing',
          currentPeriodEnd: new Date(Date.now() - DAY),
        },
      })

      const result = await controller.perform(req, res)

      expect(result.status).toBe(402)
      expect(result.result).toMatchObject({
        code: 'line-blocked',
        entitlement: 'trial-expired',
      })
      expect(client.connectChannel).not.toHaveBeenCalled()
      expect(instanceRepository.markAsConnected).not.toHaveBeenCalled()
    })

    it('recusa assinatura cancelada', async () => {
      const { client, controller } = makeDeps({
        subscription: { status: 'cancelled' },
      })

      const result = await controller.perform(req, res)

      expect(result.status).toBe(402)
      expect(result.result).toMatchObject({ entitlement: 'inactive' })
      expect(client.connectChannel).not.toHaveBeenCalled()
    })

    it('conecta quando o trial ainda está na janela', async () => {
      const { client, controller } = makeDeps({
        subscription: {
          status: 'trialing',
          currentPeriodEnd: new Date(Date.now() + DAY),
        },
      })

      const result = await controller.perform(req, res)

      expect(result.status).toBe(200)
      expect(client.connectChannel).toHaveBeenCalled()
    })

    /**
     * `Connector` ainda tem rows anteriores à SPA. Recusar todas elas trocaria um
     * bloqueio de trial por quebra do caminho legado.
     */
    it('canal sem item correspondente segue conectando', async () => {
      const { client, controller } = makeDeps({ items: [] })

      const result = await controller.perform(req, res)

      expect(result.status).toBe(200)
      expect(client.connectChannel).toHaveBeenCalled()
    })

    it('exige a instalação no token', async () => {
      const { client, controller } = makeDeps()

      const result = await controller.perform(
        { ...req, domainId: undefined } as Request,
        res,
      )

      expect(result.status).toBe(400)
      expect(client.connectChannel).not.toHaveBeenCalled()
    })
  })

  /**
   * É aqui que a WABA passa a existir para o produto: o provisionamento cria só o
   * canal, e o item da linha é a fonte que templates leem. Antes disso ela ficava
   * apenas na `Instance`, e o item nunca a recebia.
   */
  describe('WABA no item da linha', () => {
    it('grava a WABA no item, sem tocar settings nem canal vinculado', async () => {
      const { controller, updateSubscriptionItem } = makeDeps()

      await controller.perform(req, res)

      expect(updateSubscriptionItem).toHaveBeenCalledWith('item-1', {
        metadata: {
          provider: 'HUBMESSAGE',
          hubmessageChannelId: 'chan_1',
          wabaId: 'waba-1',
        },
      })
    })

    it('não reescreve quando a WABA do item já é a mesma', async () => {
      const { controller, updateSubscriptionItem } = makeDeps({
        items: [
          {
            ...hubItem,
            metadata: {
              provider: 'HUBMESSAGE',
              hubmessageChannelId: 'chan_1',
              wabaId: 'waba-1',
            },
          },
        ],
      })

      await controller.perform(req, res)

      expect(updateSubscriptionItem).not.toHaveBeenCalled()
    })

    it('canal sem item correspondente não grava nada', async () => {
      const { controller, updateSubscriptionItem } = makeDeps({ items: [] })

      await controller.perform(req, res)

      expect(updateSubscriptionItem).not.toHaveBeenCalled()
    })

    /**
     * O canal já está conectado no provider neste ponto: falhar aqui transformaria uma
     * conexão bem-sucedida em erro na cara do cliente.
     */
    it('falha ao gravar não derruba a conexão', async () => {
      const { controller, updateSubscriptionItem } = makeDeps()
      updateSubscriptionItem.mockRejectedValue(new Error('bitrix fora'))

      const result = await controller.perform(req, res)

      expect(result.status).toBe(200)
    })
  })
})
