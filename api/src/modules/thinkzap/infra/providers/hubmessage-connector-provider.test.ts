/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { HubMessageConnectorProvider } from './hubmessage-connector-provider'

function makeClient(overrides: Partial<HubMessageClient> = {}) {
  return {
    createChannel: vi
      .fn()
      .mockResolvedValue({ id: 'chan_1', name: 'x', type: 'META_WHATSAPP' }),
    createWebhook: vi.fn().mockResolvedValue({
      id: 'wh_1',
      channelId: 'chan_1',
      url: 'u',
      events: ['MESSAGE_RECEIVED', 'MESSAGE_DELIVERY'],
      status: 'ENABLED',
      signing: false,
    }),
    connectChannel: vi.fn().mockResolvedValue(undefined),
    subscribeChannel: vi.fn().mockResolvedValue(undefined),
    cancelChannel: vi.fn().mockResolvedValue(undefined),
    disconnectChannel: vi.fn().mockResolvedValue(undefined),
    listBusinesses: vi.fn().mockResolvedValue({ items: [] }),
    ...overrides,
  } as unknown as HubMessageClient
}

function business(businessId: string, connectedCount: number) {
  return {
    businessId,
    name: businessId,
    channelsCount: connectedCount + 1,
    connectedCount,
    disconnectedCount: 1,
  }
}

const config = { webhookUrl: 'https://app.example/webhooks/hubmessage' }

describe('HubMessageConnectorProvider', () => {
  it('provisiona canal META_WHATSAPP e webhook vinculado', async () => {
    const client = makeClient()
    const provider = new HubMessageConnectorProvider(client, config)

    const result = await provider.provisionConnector({ name: 'acme | canal' })

    expect(client.createChannel).toHaveBeenCalledWith({
      name: 'acme | canal',
      type: 'META_WHATSAPP',
    })
    expect(client.createWebhook).toHaveBeenCalledWith('chan_1', {
      url: config.webhookUrl,
      events: ['MESSAGE_RECEIVED', 'MESSAGE_DELIVERY'],
    })
    expect(result).toMatchObject({
      instanceId: 'chan_1',
      channelId: 'chan_1',
      webhookId: 'wh_1',
    })
  })

  it('webhook falha: canal criado é retornado sem webhookId (não fatal)', async () => {
    const client = makeClient({
      createWebhook: vi.fn().mockRejectedValue(new Error('boom')),
    })
    const provider = new HubMessageConnectorProvider(client, config)

    const result = await provider.provisionConnector({ name: 'acme | canal' })

    expect(result).toMatchObject({
      instanceId: 'chan_1',
      channelId: 'chan_1',
      webhookId: null,
    })
  })

  it('retomada idempotente: não recria canal quando existingRemoteId presente', async () => {
    const client = makeClient()
    const provider = new HubMessageConnectorProvider(client, config)

    await provider.provisionConnector({
      name: 'acme | canal',
      existingRemoteId: 'chan_existing',
    })

    expect(client.createChannel).not.toHaveBeenCalled()
    expect(client.createWebhook).toHaveBeenCalledWith(
      'chan_existing',
      expect.any(Object),
    )
  })

  it('subscribe usa channelId', async () => {
    const client = makeClient()
    const provider = new HubMessageConnectorProvider(client, config)
    await provider.subscribe({ instanceId: 'chan_1', channelId: 'chan_1' })
    expect(client.subscribeChannel).toHaveBeenCalledWith('chan_1')
  })

  it('unsubscribe cancela canal com reason', async () => {
    const client = makeClient()
    const provider = new HubMessageConnectorProvider(client, config)
    await provider.unsubscribe({ instanceId: 'chan_1' }, 'cliente saiu')
    expect(client.cancelChannel).toHaveBeenCalledWith('chan_1', 'cliente saiu')
  })

  describe('getConnectionStatus', () => {
    it('conectado quando a WABA do canal tem connectedCount > 0', async () => {
      const client = makeClient({
        listBusinesses: vi
          .fn()
          .mockResolvedValue({ items: [business('waba_1', 1)] }),
      })
      const provider = new HubMessageConnectorProvider(client, config)

      const status = await provider.getConnectionStatus({
        instanceId: 'chan_1',
        channelId: 'chan_1',
        wabaId: 'waba_1',
      })

      expect(status).toEqual({ connected: true, available: true })
    })

    it('desconectado quando a WABA tem connectedCount = 0', async () => {
      const client = makeClient({
        listBusinesses: vi
          .fn()
          .mockResolvedValue({ items: [business('waba_1', 0)] }),
      })
      const provider = new HubMessageConnectorProvider(client, config)

      const status = await provider.getConnectionStatus({
        instanceId: 'chan_1',
        wabaId: 'waba_1',
      })

      expect(status).toEqual({ connected: false, available: true })
    })

    it('desconectado (available) quando wabaId ausente — não chama a API', async () => {
      const client = makeClient()
      const provider = new HubMessageConnectorProvider(client, config)

      const status = await provider.getConnectionStatus({
        instanceId: 'chan_1',
      })

      expect(status).toEqual({ connected: false, available: true })
      expect(client.listBusinesses).not.toHaveBeenCalled()
    })

    it('desconectado quando nenhuma WABA corresponde ao wabaId', async () => {
      const client = makeClient({
        listBusinesses: vi
          .fn()
          .mockResolvedValue({ items: [business('outra', 5)] }),
      })
      const provider = new HubMessageConnectorProvider(client, config)

      const status = await provider.getConnectionStatus({
        instanceId: 'chan_1',
        wabaId: 'waba_1',
      })

      expect(status).toEqual({ connected: false, available: true })
    })

    it('available: false quando a consulta à API falha', async () => {
      const client = makeClient({
        listBusinesses: vi.fn().mockRejectedValue(new Error('boom')),
      })
      const provider = new HubMessageConnectorProvider(client, config)

      const status = await provider.getConnectionStatus({
        instanceId: 'chan_1',
        wabaId: 'waba_1',
      })

      expect(status).toEqual({ connected: false, available: false })
    })

    it('memoiza listBusinesses entre chamadas do mesmo adapter', async () => {
      const listBusinesses = vi
        .fn()
        .mockResolvedValue({ items: [business('waba_1', 1)] })
      const client = makeClient({ listBusinesses })
      const provider = new HubMessageConnectorProvider(client, config)

      await provider.getConnectionStatus({ instanceId: 'c1', wabaId: 'waba_1' })
      await provider.getConnectionStatus({ instanceId: 'c2', wabaId: 'waba_1' })

      expect(listBusinesses).toHaveBeenCalledTimes(1)
    })
  })
})
