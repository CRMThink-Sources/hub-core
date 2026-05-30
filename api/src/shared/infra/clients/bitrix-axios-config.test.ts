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

  it('returns a shared verified agent in production mode', async () => {
    const { createBitrixHttpsAgent, getBitrixAxiosDefaults } =
      await import('./bitrix-axios-config')

    const agent = createBitrixHttpsAgent()
    const defaults = getBitrixAxiosDefaults()

    expect(agent).toBeInstanceOf(https.Agent)
    expect(defaults.httpsAgent).toBe(agent)
    expect(createBitrixHttpsAgent()).toBe(agent)
  })

  it('returns a dev bypass agent when TLS verification is disabled', async () => {
    envMock.bitrix.tlsRejectUnauthorized = false

    const { createBitrixHttpsAgent } = await import('./bitrix-axios-config')
    const agent = createBitrixHttpsAgent()

    expect(agent).toBeInstanceOf(https.Agent)
    expect(
      (agent as https.Agent & { options: { rejectUnauthorized: boolean } })
        .options.rejectUnauthorized,
    ).toBe(false)
  })
})
