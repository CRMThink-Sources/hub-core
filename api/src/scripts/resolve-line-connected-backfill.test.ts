import { describe, expect, it } from 'vitest'
import {
  resolveHubMessageConnected,
  resolveLineConnectedSource,
  type LineConnectedBackfillItem,
} from './resolve-line-connected-backfill'

const item = (
  overrides: Partial<LineConnectedBackfillItem> = {},
): LineConnectedBackfillItem => ({
  itemId: '1',
  provider: 'ZAPI',
  zApiInstanceId: 'inst',
  zApiInstanceToken: 'tok',
  deleted: false,
  ...overrides,
})

describe('resolveLineConnectedSource', () => {
  it('Z-API com credencial lê pela instância', () => {
    expect(resolveLineConnectedSource(item())).toEqual({
      kind: 'zapi',
      itemId: '1',
      instanceId: 'inst',
      token: 'tok',
    })
  })

  it('normaliza caixa e espaços do provider', () => {
    expect(resolveLineConnectedSource(item({ provider: ' zapi ' })).kind).toBe(
      'zapi',
    )
  })

  it('Z-API sem token é ignorado', () => {
    expect(
      resolveLineConnectedSource(item({ zApiInstanceToken: undefined })),
    ).toEqual({ kind: 'skipped', itemId: '1', reason: 'sem-credencial' })
  })

  it('HubMessage com canal lê pela WABA', () => {
    expect(
      resolveLineConnectedSource(
        item({
          provider: 'HUBMESSAGE',
          hubmessageChannelId: 'ch',
          wabaId: 'w',
        }),
      ),
    ).toEqual({ kind: 'hubmessage', itemId: '1', wabaId: 'w' })
  })

  it('HubMessage sem canal é ignorado', () => {
    expect(
      resolveLineConnectedSource(item({ provider: 'HUBMESSAGE' })),
    ).toMatchObject({ kind: 'skipped', reason: 'sem-credencial' })
  })

  it.each([
    [{ provider: 'NONE' }, 'sem-conector'],
    [{ provider: '' }, 'provider-desconhecido'],
    [{ deleted: true }, 'excluido'],
  ])('ignora %j (%s)', (overrides, reason) => {
    expect(resolveLineConnectedSource(item(overrides))).toMatchObject({
      kind: 'skipped',
      reason,
    })
  })
})

describe('resolveHubMessageConnected', () => {
  const counts = new Map([
    ['w-on', 2],
    ['w-off', 0],
  ])

  it.each([
    ['w-on', true],
    ['w-off', false],
    ['w-ausente', false],
    [undefined, false],
  ])('WABA %s → %s', (wabaId, expected) => {
    expect(resolveHubMessageConnected(wabaId, counts)).toBe(expected)
  })
})
