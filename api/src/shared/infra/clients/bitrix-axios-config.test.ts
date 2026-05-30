import https from 'node:https'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const envMock = vi.hoisted(() => ({
  bitrix: { tlsRejectUnauthorized: true },
}))

vi.mock('@/config/env', () => ({
  env: envMock,
}))

describe('bitrix-axios-config', () => {
  beforeEach(async () => {
    vi.resetModules()
    envMock.bitrix.tlsRejectUnauthorized = true
    const mod = await import('./bitrix-axios-config')
    mod.resetBitrixHttpsAgentsForTests()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('uses fetch adapter in production mode', async () => {
    const { getBitrixAxiosDefaults } = await import('./bitrix-axios-config')

    expect(getBitrixAxiosDefaults()).toEqual({ adapter: 'fetch' })
  })

  it('uses http agent bypass when TLS verification is disabled', async () => {
    envMock.bitrix.tlsRejectUnauthorized = false

    const { createBitrixHttpsAgent, getBitrixAxiosDefaults } =
      await import('./bitrix-axios-config')

    const agent = createBitrixHttpsAgent()
    const defaults = getBitrixAxiosDefaults()

    expect(agent).toBeInstanceOf(https.Agent)
    expect(defaults.adapter).toBe('http')
    expect(defaults.httpsAgent).toBe(agent)
    expect(createBitrixHttpsAgent()).toBe(agent)
  })
})
