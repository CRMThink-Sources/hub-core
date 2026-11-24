import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import type { SpaItemResourceMirrorRepository } from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import { apiLogger } from '@/shared/infra/logger'
import { ensureLineMirror } from './ensure-line-mirror'

type Mirrors = Pick<SpaItemResourceMirrorRepository, 'find' | 'save'>

function makeMirrors(existing: Awaited<ReturnType<Mirrors['find']>> = null) {
  const find = vi.fn<Mirrors['find']>().mockResolvedValue(existing)
  const save = vi.fn<Mirrors['save']>().mockResolvedValue(undefined)
  return { mirrors: { find, save } satisfies Mirrors, find, save }
}

describe('ensureLineMirror', () => {
  it('espelho existente: não grava nada', async () => {
    const { mirrors, save } = makeMirrors({
      provider: 'ZAPI',
      instanceId: 'INST',
      zApiToken: 'tok',
      subscriptionId: '239',
      subscribedAt: '2026-11-24T13:21:10.555Z',
    })

    const outcome = await ensureLineMirror(mirrors, {
      itemId: '317',
      resource: { provider: 'ZAPI', instanceId: 'INST', zApiToken: 'tok' },
      subscriptionId: '239',
    })

    expect(outcome).toBe('present')
    expect(save).not.toHaveBeenCalled()
  })

  it('Z-API sem espelho: grava instância, token e assinatura pai', async () => {
    const { mirrors, save } = makeMirrors()

    const outcome = await ensureLineMirror(mirrors, {
      itemId: '317',
      resource: { provider: 'ZAPI', instanceId: 'INST', zApiToken: 'tok' },
      subscriptionId: '239',
    })

    expect(outcome).toBe('created')
    expect(save).toHaveBeenCalledWith('317', {
      provider: 'ZAPI',
      instanceId: 'INST',
      zApiToken: 'tok',
      subscriptionId: '239',
    })
  })

  it('HubMessage sem espelho: grava o canal e não inventa token', async () => {
    const { mirrors, save } = makeMirrors()

    const outcome = await ensureLineMirror(mirrors, {
      itemId: '409',
      resource: {
        provider: 'HUBMESSAGE',
        instanceId: 'CANAL',
        channelId: 'CANAL',
      },
      subscriptionId: '239',
    })

    expect(outcome).toBe('created')
    const saved = save.mock.calls[0]?.[1]
    expect(saved).toEqual({
      provider: 'HUBMESSAGE',
      instanceId: 'CANAL',
      channelId: 'CANAL',
      subscriptionId: '239',
    })
    expect(saved).not.toHaveProperty('zApiToken')
  })

  it('sem assinatura pai: não grava e avisa', async () => {
    const { mirrors, save } = makeMirrors()

    const outcome = await ensureLineMirror(mirrors, {
      itemId: '317',
      resource: { provider: 'ZAPI', instanceId: 'INST', zApiToken: 'tok' },
      subscriptionId: null,
    })

    expect(outcome).toBe('no-parent')
    expect(save).not.toHaveBeenCalled()
    expect(apiLogger.warn).toHaveBeenCalledWith(
      { app: 'thinkzap', itemId: '317' },
      expect.stringContaining('Item sem assinatura pai'),
    )
  })
})
