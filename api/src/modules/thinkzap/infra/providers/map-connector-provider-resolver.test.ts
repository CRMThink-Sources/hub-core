import { describe, expect, it } from 'vitest'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { WhatsAppConnectorProvider } from '@/modules/thinkzap/domain/ports/whatsapp-connector-provider.port'
import { MapConnectorProviderResolver } from './map-connector-provider-resolver'

function fakeProvider(): WhatsAppConnectorProvider {
  return {
    provisionConnector: () =>
      Promise.resolve({ instanceId: 'x', status: 'CONNECTED' as never }),
    subscribe: () => Promise.resolve('subscribed' as const),
    unsubscribe: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    getConnectionStatus: () =>
      Promise.resolve({ connected: false, available: true }),
  }
}

describe('MapConnectorProviderResolver', () => {
  it('resolve o adapter ZAPI', () => {
    const zapi = fakeProvider()
    const resolver = new MapConnectorProviderResolver({
      [ConnectorProvider.ZAPI]: zapi,
    })
    expect(resolver.resolve(ConnectorProvider.ZAPI)).toBe(zapi)
  })

  it('resolve o adapter HUBMESSAGE', () => {
    const hub = fakeProvider()
    const resolver = new MapConnectorProviderResolver({
      [ConnectorProvider.HUBMESSAGE]: hub,
    })
    expect(resolver.resolve(ConnectorProvider.HUBMESSAGE)).toBe(hub)
  })

  it('lança erro para provider não suportado sem executar operações', () => {
    const resolver = new MapConnectorProviderResolver({})
    expect(() => resolver.resolve(ConnectorProvider.HUBMESSAGE)).toThrow(
      /não suportado/,
    )
  })
})
