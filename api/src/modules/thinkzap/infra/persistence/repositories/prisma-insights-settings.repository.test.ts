import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  updateMany: vi.fn(),
}))

vi.mock('@/config/prisma', () => ({
  prisma: {
    thinkzapInsightsSettings: {
      findUnique: m.findUnique,
      upsert: m.upsert,
      updateMany: m.updateMany,
    },
  },
}))

import { INSIGHTS_CONFIG_DEFAULT } from '@/modules/thinkzap/domain/insights-config'
import { PrismaInsightsSettingsRepository } from './prisma-insights-settings.repository'

describe('PrismaInsightsSettingsRepository', () => {
  const repo = new PrismaInsightsSettingsRepository()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('get devolve null sem linha', async () => {
    m.findUnique.mockResolvedValue(null)

    expect(await repo.get('app-1')).toBeNull()
    expect(m.findUnique).toHaveBeenCalledWith({ where: { appId: 'app-1' } })
  })

  it('get mapeia a linha', async () => {
    const validatedAt = new Date('2026-11-19T00:00:00Z')
    m.findUnique.mockResolvedValue({
      vibecodeKeyEnc: 'enc',
      vibecodeKeyLast4: 'abcd',
      vibecodePortalId: 'p1',
      vibecodeValidatedAt: validatedAt,
      config: { refMin: 20 },
    })

    expect(await repo.get('app-1')).toEqual({
      keyEnc: 'enc',
      last4: 'abcd',
      portalId: 'p1',
      validatedAt,
      config: { refMin: 20 },
    })
  })

  it('saveKey faz upsert por appId', async () => {
    const validatedAt = new Date('2026-11-19T00:00:00Z')

    await repo.saveKey('app-1', {
      keyEnc: 'enc',
      last4: 'abcd',
      portalId: null,
      validatedAt,
    })

    const data = {
      vibecodeKeyEnc: 'enc',
      vibecodeKeyLast4: 'abcd',
      vibecodePortalId: null,
      vibecodeValidatedAt: validatedAt,
    }
    expect(m.upsert).toHaveBeenCalledWith({
      where: { appId: 'app-1' },
      create: { appId: 'app-1', ...data },
      update: data,
    })
  })

  it('removeKey zera os campos da chave sem apagar config', async () => {
    await repo.removeKey('app-1')

    expect(m.updateMany).toHaveBeenCalledWith({
      where: { appId: 'app-1' },
      data: {
        vibecodeKeyEnc: null,
        vibecodeKeyLast4: null,
        vibecodePortalId: null,
        vibecodeValidatedAt: null,
      },
    })
  })

  it('saveConfig faz upsert só do config', async () => {
    await repo.saveConfig('app-1', INSIGHTS_CONFIG_DEFAULT)

    expect(m.upsert).toHaveBeenCalledWith({
      where: { appId: 'app-1' },
      create: { appId: 'app-1', config: INSIGHTS_CONFIG_DEFAULT },
      update: { config: INSIGHTS_CONFIG_DEFAULT },
    })
  })
})
