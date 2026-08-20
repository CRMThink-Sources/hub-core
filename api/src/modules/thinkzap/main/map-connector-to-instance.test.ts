import { describe, expect, it, vi } from 'vitest'
import { Connector, ConnectorProvider } from '../domain/entities/connector'
import { InstanceStatus } from '../domain/entities/instance'
import { ConnectorProviderResolver } from '../domain/ports/connector-provider-resolver.port'
import {
  ConnectorConnectionStatus,
  WhatsAppConnectorProvider,
} from '../domain/ports/whatsapp-connector-provider.port'
import { MapConnectorToInstance } from './map-connector-to-instance'

/**
 * `MapConnectorToInstance` devolve `Promise<any>` — a serialização mistura o payload
 * da Z-API com campos montados à mão e nunca teve tipo. Este é o contrato que os
 * asserts abaixo dependem; sem ele, cada acesso vira `no-unsafe-member-access`.
 */
type MappedConnector = {
  id: string
  instanceId: string
  appId: string
  provider: ConnectorProvider
  phoneData: unknown
  instance: { connected: boolean; paidStatus: string; channelId: string | null }
}

const mapHub = (
  connector: Connector,
  resolver: ConnectorProviderResolver,
): Promise<MappedConnector> =>
  MapConnectorToInstance(connector, resolver) as Promise<MappedConnector>

function fakeResolver(
  status: ConnectorConnectionStatus,
): ConnectorProviderResolver {
  const provider = {
    getConnectionStatus: vi.fn().mockResolvedValue(status),
  } as unknown as WhatsAppConnectorProvider
  return { resolve: () => provider }
}

function hubConnector(
  overrides: Partial<Connector['instance']> = {},
): Connector {
  return {
    id: 'conn_1',
    instanceId: 'chan_1',
    appId: 'app_1',
    provider: ConnectorProvider.HUBMESSAGE,
    instance: {
      status: InstanceStatus.CONNECTING,
      channelId: 'chan_1',
      wabaId: 'waba_1',
      ...overrides,
    } as never,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('MapConnectorToInstance (HubMessage)', () => {
  it('usa o status ao vivo quando disponível', async () => {
    const resolver = fakeResolver({ connected: true, available: true })

    const result = await mapHub(hubConnector(), resolver)

    expect(result.provider).toBe(ConnectorProvider.HUBMESSAGE)
    expect(result.instance.connected).toBe(true)
  })

  it('vivo desconectado sobrepõe o status persistido CONNECTED', async () => {
    const resolver = fakeResolver({ connected: false, available: true })

    const result = await mapHub(
      hubConnector({ status: InstanceStatus.CONNECTED } as never),
      resolver,
    )

    expect(result.instance.connected).toBe(false)
  })

  it('fallback ao status persistido quando a consulta indisponível', async () => {
    const resolver = fakeResolver({ connected: false, available: false })

    const connected = await mapHub(
      hubConnector({ status: InstanceStatus.CONNECTED } as never),
      resolver,
    )
    const disconnected = await mapHub(
      hubConnector({ status: InstanceStatus.CONNECTING } as never),
      resolver,
    )

    expect(connected.instance.connected).toBe(true)
    expect(disconnected.instance.connected).toBe(false)
  })

  it('preserva o shape esperado pelo front', async () => {
    const resolver = fakeResolver({ connected: true, available: true })

    const result = await mapHub(hubConnector(), resolver)

    expect(result).toMatchObject({
      id: 'conn_1',
      instanceId: 'chan_1',
      appId: 'app_1',
      provider: ConnectorProvider.HUBMESSAGE,
      phoneData: null,
      instance: {
        connected: true,
        paidStatus: 'PAID',
        channelId: 'chan_1',
      },
    })
  })
})
