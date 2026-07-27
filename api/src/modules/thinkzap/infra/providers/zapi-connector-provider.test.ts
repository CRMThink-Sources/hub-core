/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { ZApiConnectorProvider } from './zapi-connector-provider'

function makeClient(overrides: Partial<ZApiClient> = {}) {
  return {
    getInstanceStatus: vi.fn().mockResolvedValue({
      connected: true,
      session: 'x',
      created: '',
      error: null,
      smartphoneConnected: true,
    }),
    ...overrides,
  } as unknown as ZApiClient
}

const gateway = {} as never

describe('ZApiConnectorProvider.getConnectionStatus', () => {
  it('connected ao vivo quando o status Z-API retorna connected: true', async () => {
    const client = makeClient()
    const provider = new ZApiConnectorProvider(gateway, client)

    const status = await provider.getConnectionStatus({
      instanceId: 'inst_1',
      zApiToken: 'tok',
    })

    expect(client.getInstanceStatus).toHaveBeenCalledWith('inst_1', 'tok')
    expect(status).toEqual({ connected: true, available: true })
  })

  it('desconectado quando connected: false', async () => {
    const client = makeClient({
      getInstanceStatus: vi.fn().mockResolvedValue({ connected: false }),
    })
    const provider = new ZApiConnectorProvider(gateway, client)

    const status = await provider.getConnectionStatus({
      instanceId: 'inst_1',
      zApiToken: 'tok',
    })

    expect(status).toEqual({ connected: false, available: true })
  })

  it('available: false quando falta token', async () => {
    const client = makeClient()
    const provider = new ZApiConnectorProvider(gateway, client)

    const status = await provider.getConnectionStatus({ instanceId: 'inst_1' })

    expect(status).toEqual({ connected: false, available: false })
    expect(client.getInstanceStatus).not.toHaveBeenCalled()
  })

  it('available: false quando a consulta falha', async () => {
    const client = makeClient({
      getInstanceStatus: vi.fn().mockRejectedValue(new Error('boom')),
    })
    const provider = new ZApiConnectorProvider(gateway, client)

    const status = await provider.getConnectionStatus({
      instanceId: 'inst_1',
      zApiToken: 'tok',
    })

    expect(status).toEqual({ connected: false, available: false })
  })
})
