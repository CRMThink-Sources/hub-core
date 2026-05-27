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

  it('parses known settings', () => {
    expect(parseConnectorSettings({ prefixOperatorNameEnabled: true })).toEqual(
      {
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

describe('mergeConnectorSettings', () => {
  it('merges partial settings without dropping existing values', () => {
    expect(
      mergeConnectorSettings(DEFAULT_CONNECTOR_SETTINGS, {
        prefixOperatorNameEnabled: true,
      }),
    ).toEqual({
      prefixOperatorNameEnabled: true,
    })
  })

  it('ignores invalid partial values', () => {
    expect(
      mergeConnectorSettings(DEFAULT_CONNECTOR_SETTINGS, {
        prefixOperatorNameEnabled: 'yes' as unknown as boolean,
      }),
    ).toEqual(DEFAULT_CONNECTOR_SETTINGS)
  })
})
