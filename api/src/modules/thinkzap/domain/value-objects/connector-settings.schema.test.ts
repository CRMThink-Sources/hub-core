import { describe, expect, it } from 'vitest'
import {
  mergeConnectorSettings,
  parseConnectorSettings,
} from './connector-settings.schema'
import { DEFAULT_CONNECTOR_SETTINGS } from './connector-settings'

describe('parseConnectorSettings', () => {
  it('returns defaults for empty object', () => {
    expect(parseConnectorSettings({})).toEqual(DEFAULT_CONNECTOR_SETTINGS)
  })

  it('returns defaults for null', () => {
    expect(parseConnectorSettings(null)).toEqual(DEFAULT_CONNECTOR_SETTINGS)
  })

  /**
   * O parse **completa** com os defaults em vez de devolver só o que veio: o
   * consumidor recebe sempre os quatro toggles resolvidos, e nenhum precisa de
   * `?? false`. A expectativa antiga só passava quando `ConnectorSettings` tinha
   * um campo.
   */
  it('parses known settings', () => {
    expect(parseConnectorSettings({ prefixOperatorNameEnabled: true })).toEqual(
      {
        ...DEFAULT_CONNECTOR_SETTINGS,
        prefixOperatorNameEnabled: true,
      },
    )
  })

  it('returns defaults for invalid JSON shape', () => {
    expect(
      parseConnectorSettings({ prefixOperatorNameEnabled: 'yes' }),
    ).toEqual(DEFAULT_CONNECTOR_SETTINGS)
  })
})

describe('parseConnectorSettings (limite diário)', () => {
  it('settings antigos sem os campos leem o limite desligado', () => {
    const parsed = parseConnectorSettings({
      prefixOperatorNameEnabled: true,
      messageDeleteEventEnabled: false,
    })

    expect(parsed.dailyLimitEnabled).toBe(false)
    expect(parsed.dailyLimit).toBeNull()
    expect(parsed.prefixOperatorNameEnabled).toBe(true)
  })

  it('lê o limite gravado', () => {
    expect(
      parseConnectorSettings({ dailyLimitEnabled: true, dailyLimit: 300 }),
    ).toEqual({
      ...DEFAULT_CONNECTOR_SETTINGS,
      dailyLimitEnabled: true,
      dailyLimit: 300,
    })
  })

  it('valor estranho no limite cai no default só daquele campo', () => {
    const parsed = parseConnectorSettings({
      prefixOperatorNameEnabled: true,
      dailyLimitEnabled: 'sim',
      dailyLimit: -5,
    })

    expect(parsed).toEqual({
      ...DEFAULT_CONNECTOR_SETTINGS,
      prefixOperatorNameEnabled: true,
    })
  })
})

describe('mergeConnectorSettings', () => {
  it('grava o limite preservando os toggles', () => {
    const current = {
      ...DEFAULT_CONNECTOR_SETTINGS,
      prefixOperatorNameEnabled: true,
    }

    expect(
      mergeConnectorSettings(current, {
        dailyLimitEnabled: true,
        dailyLimit: 300,
      }),
    ).toEqual({ ...current, dailyLimitEnabled: true, dailyLimit: 300 })
  })

  it('patch sem o limite preserva o limite gravado', () => {
    const current = {
      ...DEFAULT_CONNECTOR_SETTINGS,
      dailyLimitEnabled: true,
      dailyLimit: 300,
    }

    expect(
      mergeConnectorSettings(current, { widgetOpenChannelEnabled: true }),
    ).toEqual({ ...current, widgetOpenChannelEnabled: true })
  })

  it('merges partial settings without dropping existing values', () => {
    expect(
      mergeConnectorSettings(DEFAULT_CONNECTOR_SETTINGS, {
        prefixOperatorNameEnabled: true,
      }),
    ).toEqual({
      ...DEFAULT_CONNECTOR_SETTINGS,
      prefixOperatorNameEnabled: true,
    })
  })

  it('preserva os toggles que o patch não menciona', () => {
    const current = {
      ...DEFAULT_CONNECTOR_SETTINGS,
      widgetOpenChannelEnabled: true,
      messageDeleteEventEnabled: false,
    }

    expect(
      mergeConnectorSettings(current, { prefixOperatorNameEnabled: true }),
    ).toEqual({ ...current, prefixOperatorNameEnabled: true })
  })

  it('ignores invalid partial values', () => {
    expect(
      mergeConnectorSettings(DEFAULT_CONNECTOR_SETTINGS, {
        prefixOperatorNameEnabled: 'yes' as unknown as boolean,
      }),
    ).toEqual(DEFAULT_CONNECTOR_SETTINGS)
  })
})
