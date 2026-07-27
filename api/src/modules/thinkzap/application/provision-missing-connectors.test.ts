/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/require-await */
import { describe, expect, it, vi } from 'vitest'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { InstanceStatus } from '@/modules/thinkzap/domain/entities/instance'
import { WhatsAppConnectorProvider } from '@/modules/thinkzap/domain/ports/whatsapp-connector-provider.port'
import { provisionMissingConnectorsForProvider } from './provision-missing-connectors'

vi.mock('./sync-robot-connectors', () => ({
  syncThinkzapRobotConnectorOptions: vi.fn().mockResolvedValue(undefined),
}))

function makeAdapter(remoteId: string): WhatsAppConnectorProvider {
  return {
    provisionConnector: vi.fn().mockResolvedValue({
      instanceId: remoteId,
      status: InstanceStatus.CONNECTED,
      zApiToken: remoteId === 'zapi-new' ? 'tok' : null,
      channelId: remoteId.startsWith('chan') ? remoteId : null,
    }),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getConnectionStatus: vi
      .fn()
      .mockResolvedValue({ connected: true, available: true }),
  }
}

function makeDeps(
  existing: Array<{ provider: ConnectorProvider }>,
  adapters: Record<string, WhatsAppConnectorProvider>,
) {
  return {
    createConnectorRepo: {
      createConnector: vi.fn().mockResolvedValue(undefined),
    },
    createInstanceRepo: {
      create: vi.fn().mockImplementation(async (i: { instanceId: string }) => ({
        id: 'db-' + i.instanceId,
        ...i,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    },
    getApp: {
      getById: vi.fn().mockResolvedValue({ id: 'app1', domainId: 'dom1' }),
    },
    getDomainRepository: {
      getDomainById: vi.fn().mockResolvedValue({ id: 'dom1', name: 'acme' }),
    },
    listConnectors: {
      listConnectors: vi.fn().mockResolvedValue(
        existing.map((c, idx) => ({
          id: 'c' + idx,
          appId: 'app1',
          instanceId: 'i' + idx,
          provider: c.provider,
          instance: {
            instanceId: 'remote' + idx,
            zApiToken: 'tok',
            channelId: null,
          },
        })),
      ),
    },
    billingSubscriptionRepo: {} as never,
    providerResolver: { resolve: (p: ConnectorProvider) => adapters[p] },
  } as never
}

describe('provisionMissingConnectorsForProvider', () => {
  it('cria conectores Z-API faltantes', async () => {
    const zapi = makeAdapter('zapi-new')
    const deps = makeDeps([], { [ConnectorProvider.ZAPI]: zapi })

    const res = await provisionMissingConnectorsForProvider(
      deps,
      'app1',
      ConnectorProvider.ZAPI,
      2,
      { isTrialing: false },
    )

    expect(res.created).toBe(2)
    expect(zapi.provisionConnector).toHaveBeenCalledTimes(2)
    // fora de trial, assina os criados
    expect(zapi.subscribe).toHaveBeenCalledTimes(2)
  })

  it('cria conectores HubMessage independente dos Z-API existentes', async () => {
    const hub = makeAdapter('chan-new')
    const zapi = makeAdapter('zapi-new')
    // já existe 1 Z-API; alvo HubMessage = 2 → cria 2 HubMessage, ignora Z-API
    const deps = makeDeps([{ provider: ConnectorProvider.ZAPI }], {
      [ConnectorProvider.HUBMESSAGE]: hub,
      [ConnectorProvider.ZAPI]: zapi,
    })

    const res = await provisionMissingConnectorsForProvider(
      deps,
      'app1',
      ConnectorProvider.HUBMESSAGE,
      2,
      { isTrialing: false },
    )

    expect(res.created).toBe(2)
    expect(hub.provisionConnector).toHaveBeenCalledTimes(2)
    expect(zapi.provisionConnector).not.toHaveBeenCalled()
  })

  it('trial não assina, respeita alvo', async () => {
    const zapi = makeAdapter('zapi-new')
    const deps = makeDeps([], { [ConnectorProvider.ZAPI]: zapi })

    const res = await provisionMissingConnectorsForProvider(
      deps,
      'app1',
      ConnectorProvider.ZAPI,
      1,
      { isTrialing: true },
    )

    expect(res.created).toBe(1)
    expect(zapi.subscribe).not.toHaveBeenCalled()
  })

  it('idempotente: nada a criar quando já atingiu o alvo', async () => {
    const hub = makeAdapter('chan-new')
    const deps = makeDeps(
      [
        { provider: ConnectorProvider.HUBMESSAGE },
        { provider: ConnectorProvider.HUBMESSAGE },
      ],
      { [ConnectorProvider.HUBMESSAGE]: hub },
    )

    const res = await provisionMissingConnectorsForProvider(
      deps,
      'app1',
      ConnectorProvider.HUBMESSAGE,
      2,
      { isTrialing: false },
    )

    expect(res.created).toBe(0)
    expect(hub.provisionConnector).not.toHaveBeenCalled()
    // assina os 2 existentes
    expect(hub.subscribe).toHaveBeenCalledTimes(2)
  })
})
