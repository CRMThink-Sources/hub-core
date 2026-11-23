import { describe, expect, it, vi } from 'vitest'
import { INSIGHTS_CONFIG_DEFAULT } from '@/modules/thinkzap/domain/insights-config'
import type {
  InsightsSettings,
  InsightsSettingsRepository,
} from '@/modules/thinkzap/domain/repositories/insights-settings/insights-settings.repository'
import { GetInsightsConfig } from './get-insights-config'
import { SaveInsightsConfig } from './save-insights-config'

function row(config: InsightsSettings['config']): InsightsSettings {
  return {
    keyEnc: null,
    last4: null,
    portalId: null,
    validatedAt: null,
    config,
  }
}

function setup(stored: InsightsSettings | null) {
  const get = vi
    .fn<InsightsSettingsRepository['get']>()
    .mockResolvedValue(stored)
  const saveConfig = vi
    .fn<InsightsSettingsRepository['saveConfig']>()
    .mockResolvedValue(undefined)
  const settings = { get, saveConfig } as unknown as InsightsSettingsRepository
  return {
    get: new GetInsightsConfig({ settings }),
    save: new SaveInsightsConfig({ settings }),
    saveConfig,
  }
}

describe('GetInsightsConfig', () => {
  it('sem registro devolve o padrão', async () => {
    const { get } = setup(null)
    expect(await get.execute('app-1')).toEqual(INSIGHTS_CONFIG_DEFAULT)
  })

  it('mescla o salvo sobre o padrão', async () => {
    const { get } = setup(row({ refMin: 5, sources: ['x'] }))
    expect(await get.execute('app-1')).toEqual({
      ...INSIGHTS_CONFIG_DEFAULT,
      refMin: 5,
      sources: ['x'],
    })
  })
})

describe('SaveInsightsConfig', () => {
  it('saveConfig normaliza limites', async () => {
    const { save, saveConfig } = setup(null)
    const out = await save.execute('app-1', {
      refMin: 0,
      bhStart: 30,
      bhEnd: 10,
      bhDays: [0, 6, 7, -1, '3'],
      bizOnly: 0,
      stuckDays: 0,
      dealWindowDays: -4,
      sources: [12, 'hubthink_thinkzap_a'],
      extra: 'ignorado',
    })
    const expected = {
      refMin: 15,
      bhStart: 23,
      bhEnd: 24,
      bhDays: [0, 6, 3],
      bizOnly: false,
      stuckDays: 3,
      dealWindowDays: 0,
      sources: ['12', 'hubthink_thinkzap_a'],
    }
    expect(out).toEqual(expected)
    expect(saveConfig).toHaveBeenCalledWith('app-1', expected)
  })

  it('refMin negativo vira 1 e bhEnd <= bhStart vira bhStart + 1', async () => {
    const { save } = setup(null)
    const out = await save.execute('app-1', {
      refMin: -5,
      bhStart: 9,
      bhEnd: 9,
      stuckDays: -2,
    })
    expect(out).toEqual({
      ...INSIGHTS_CONFIG_DEFAULT,
      refMin: 1,
      bhStart: 9,
      bhEnd: 10,
      stuckDays: 1,
    })
  })

  it('patch parcial preserva o que já estava salvo', async () => {
    const { save } = setup(row({ refMin: 7, bhDays: [1, 2] }))
    const out = await save.execute('app-1', { bizOnly: false })
    expect(out).toEqual({
      ...INSIGHTS_CONFIG_DEFAULT,
      refMin: 7,
      bhDays: [1, 2],
      bizOnly: false,
    })
  })
})
