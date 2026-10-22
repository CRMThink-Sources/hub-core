import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { EnsureConnectorRegistration } from './ensure-connector-registration'

const connector = vi.hoisted(() => ({
  code: 'hubthink_thinkzap',
  name: 'ThinkZap',
  url: 'https://app.example/thinkzap/connector',
}))

vi.mock('@/config/env', () => ({
  env: { bitrix: { connector } },
}))

vi.mock('@/shared/infra/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

describe('EnsureConnectorRegistration', () => {
  const callMethod = vi.fn()
  const client = { callMethod } as unknown as BitrixRestClient
  const service = new EnsureConnectorRegistration()

  const registerCalls = () =>
    callMethod.mock.calls.filter(([method]) => method === 'imconnector.register')

  beforeEach(() => {
    vi.clearAllMocks()
    connector.url = 'https://app.example/thinkzap/connector'
  })

  it('registra com o PLACEMENT_HANDLER do env e retorna created', async () => {
    callMethod.mockImplementation(async (method: string) =>
      method === 'imconnector.list' ? {} : true,
    )

    await expect(service.execute(client)).resolves.toBe('created')
    expect(registerCalls()).toHaveLength(1)
    expect(registerCalls()[0]?.[1]).toMatchObject({
      ID: 'hubthink_thinkzap',
      PLACEMENT_HANDLER: 'https://app.example/thinkzap/connector',
    })
  })

  it('retorna updated quando o conector já existe no portal', async () => {
    callMethod.mockImplementation(async (method: string) =>
      method === 'imconnector.list' ? { hubthink_thinkzap: 'ThinkZap' } : true,
    )

    await expect(service.execute(client)).resolves.toBe('updated')
    expect(registerCalls()).toHaveLength(1)
  })

  it('não registra sem BITRIX_CONNECTOR_URL', async () => {
    connector.url = ''

    await expect(service.execute(client)).resolves.toBe('skipped')
    expect(callMethod).not.toHaveBeenCalled()
  })
})
