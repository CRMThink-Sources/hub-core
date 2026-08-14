import { describe, expect, it } from 'vitest'
import { resolveMirrorBackfill } from './resolve-spa-item-resource-mirror-backfill'

const item = (overrides: Record<string, unknown> = {}) => ({
  id: '77',
  provider: 'ZAPI',
  credentials: { zApiInstanceId: 'inst-1', zApiInstanceToken: 'tok-1' },
  subscriptionId: '42',
  ...overrides,
})

describe('resolveMirrorBackfill', () => {
  it('monta o espelho de uma linha Z-API', () => {
    expect(resolveMirrorBackfill(item())).toEqual({
      kind: 'mirror',
      itemId: '77',
      mirror: {
        provider: 'ZAPI',
        instanceId: 'inst-1',
        zApiToken: 'tok-1',
        subscriptionId: '42',
      },
    })
  })

  it('monta o espelho de uma linha HubMessage pelo canal', () => {
    expect(
      resolveMirrorBackfill(
        item({
          provider: 'HUBMESSAGE',
          credentials: { hubmessageChannelId: 'chan-1', wabaId: 'waba-1' },
        }),
      ),
    ).toEqual({
      kind: 'mirror',
      itemId: '77',
      mirror: {
        provider: 'HUBMESSAGE',
        instanceId: 'chan-1',
        channelId: 'chan-1',
        subscriptionId: '42',
      },
    })
  })

  /**
   * A garantia mais importante do backfill. Marca gravada sem desassinatura esconderia
   * para sempre um recurso que continua sendo cobrado de nós.
   */
  it('não marca desassinado, nem para item já cancelado', () => {
    const outcome = resolveMirrorBackfill(
      item({ status: 'cancelled' } as never),
    )

    expect(outcome.kind).toBe('mirror')
    expect(
      Object.keys(
        (outcome as { mirror: Record<string, unknown> }).mirror,
      ),
    ).not.toContain('unsubscribedAt')
  })

  it('pula item sem credencial legível', () => {
    for (const credentials of [{}, { zApiInstanceId: 'inst-1' }]) {
      expect(resolveMirrorBackfill(item({ credentials }))).toEqual({
        kind: 'skipped',
        itemId: '77',
        reason: 'sem-credencial',
      })
    }
  })

  it('pula item com provider vazio ou NONE', () => {
    for (const provider of ['', 'NONE']) {
      expect(resolveMirrorBackfill(item({ provider })).kind).toBe('skipped')
    }
  })

  it('pula item sem assinatura pai — o espelho não serviria ao ajuste de cobrança', () => {
    expect(resolveMirrorBackfill(item({ subscriptionId: null }))).toEqual({
      kind: 'skipped',
      itemId: '77',
      reason: 'sem-assinatura-pai',
    })
  })
})
