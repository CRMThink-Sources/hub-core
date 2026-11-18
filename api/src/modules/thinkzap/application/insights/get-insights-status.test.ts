import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  InsightsSettings,
  InsightsSettingsRepository,
} from '@/modules/thinkzap/domain/repositories/insights-settings/insights-settings.repository'
import { GetInsightsStatus } from './get-insights-status'
import {
  clearKeyProblem,
  markKeyRevoked,
  markKeyUnreadable,
} from './key-health'

function setup(row: InsightsSettings | null) {
  const get = vi.fn<InsightsSettingsRepository['get']>().mockResolvedValue(row)
  return new GetInsightsStatus({
    settings: { get } as unknown as InsightsSettingsRepository,
  })
}

const withKey: InsightsSettings = {
  keyEnc: 'v1:abc',
  last4: 'WXYZ',
  portalId: '1',
  validatedAt: new Date('2026-11-18T10:00:00Z'),
  config: null,
}

describe('GetInsightsStatus', () => {
  beforeEach(() => clearKeyProblem('app-1'))

  it('status lean sem chave', async () => {
    const status = await setup(null).execute('app-1', {
      includeKeyDetails: true,
    })
    expect(status).toEqual({
      mode: 'lean',
      keyConfigured: false,
      last4: null,
      validatedAt: null,
      keyProblem: null,
    })
  })

  it('status full com detalhes para admin', async () => {
    const status = await setup(withKey).execute('app-1', {
      includeKeyDetails: true,
    })
    expect(status).toMatchObject({
      mode: 'full',
      keyConfigured: true,
      last4: 'WXYZ',
      validatedAt: '2026-11-18T10:00:00.000Z',
    })
  })

  it('status não expõe last4 sem includeKeyDetails', async () => {
    const status = await setup(withKey).execute('app-1', {
      includeKeyDetails: false,
    })
    expect(status.mode).toBe('full')
    expect(status.last4).toBeNull()
    expect(status.validatedAt).toBeNull()
  })

  it('reporta chave revogada', async () => {
    markKeyRevoked('app-1')
    const status = await setup(withKey).execute('app-1', {
      includeKeyDetails: false,
    })
    expect(status.keyProblem).toBe('revoked')
    expect(status.mode).toBe('lean')
    expect(status.keyConfigured).toBe(true)
  })

  it('chave ilegível também deixa o modo enxuto', async () => {
    markKeyUnreadable('app-1')
    const status = await setup(withKey).execute('app-1', {
      includeKeyDetails: false,
    })
    expect(status).toMatchObject({
      mode: 'lean',
      keyConfigured: true,
      keyProblem: 'unreadable',
    })
  })
})
