import { describe, expect, it, vi } from 'vitest'
import { createResolveGroupMentions } from './resolve-group-mentions'

function makeFakeRedis(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
      return 'OK'
    }),
    store,
  }
}

function makeFakeZApiClient(
  participants: { phone: string; lid?: string }[],
) {
  return {
    getGroupMetadata: vi.fn().mockResolvedValue({ participants }),
  }
}

describe('resolveGroupMentions', () => {
  it('resolves a single mention to the matching participant phone', async () => {
    const redis = makeFakeRedis()
    const zApiClient = makeFakeZApiClient([
      { phone: '554788907930', lid: '159447120928786@lid' },
    ])
    const resolve = createResolveGroupMentions({
      redis: redis as never,
      zApiClient: zApiClient as never,
    })

    const result = await resolve('@159447120928786', {
      instanceId: 'INST-A',
      zApiToken: 'tok',
      groupId: 'grp-1',
    })

    expect(result).toBe('[b]@554788907930[/b]')
    expect(zApiClient.getGroupMetadata).toHaveBeenCalledWith(
      'INST-A',
      'tok',
      'grp-1',
    )
  })

  it('resolves multiple mentions independently', async () => {
    const redis = makeFakeRedis()
    const zApiClient = makeFakeZApiClient([
      { phone: '554788907930', lid: '159447120928786@lid' },
      { phone: '554388092447', lid: '271902299951214@lid' },
    ])
    const resolve = createResolveGroupMentions({
      redis: redis as never,
      zApiClient: zApiClient as never,
    })

    const result = await resolve(
      'Fala @159447120928786 e @271902299951214',
      { instanceId: 'INST-A', zApiToken: 'tok', groupId: 'grp-1' },
    )

    expect(result).toBe(
      'Fala [b]@554788907930[/b] e [b]@554388092447[/b]',
    )
  })

  it('leaves an unmatched mention token unchanged', async () => {
    const redis = makeFakeRedis()
    const zApiClient = makeFakeZApiClient([
      { phone: '554788907930', lid: '159447120928786@lid' },
    ])
    const resolve = createResolveGroupMentions({
      redis: redis as never,
      zApiClient: zApiClient as never,
    })

    const result = await resolve('@000000000000000', {
      instanceId: 'INST-A',
      zApiToken: 'tok',
      groupId: 'grp-1',
    })

    expect(result).toBe('@000000000000000')
  })

  it('returns the original text when the group-metadata fetch fails', async () => {
    const redis = makeFakeRedis()
    const zApiClient = {
      getGroupMetadata: vi.fn().mockRejectedValue(new Error('timeout')),
    }
    const resolve = createResolveGroupMentions({
      redis: redis as never,
      zApiClient: zApiClient as never,
    })

    const result = await resolve('@159447120928786', {
      instanceId: 'INST-A',
      zApiToken: 'tok',
      groupId: 'grp-1',
    })

    expect(result).toBe('@159447120928786')
  })

  it('uses the cache on a second call instead of hitting the Z-API again', async () => {
    const redis = makeFakeRedis()
    const zApiClient = makeFakeZApiClient([
      { phone: '554788907930', lid: '159447120928786@lid' },
    ])
    const resolve = createResolveGroupMentions({
      redis: redis as never,
      zApiClient: zApiClient as never,
    })
    const input = { instanceId: 'INST-A', zApiToken: 'tok', groupId: 'grp-1' }

    await resolve('@159447120928786', input)
    const result = await resolve('@159447120928786', input)

    expect(result).toBe('[b]@554788907930[/b]')
    expect(zApiClient.getGroupMetadata).toHaveBeenCalledTimes(1)
  })

  it('does not call the Z-API when the text has no mention token', async () => {
    const redis = makeFakeRedis()
    const zApiClient = makeFakeZApiClient([])
    const resolve = createResolveGroupMentions({
      redis: redis as never,
      zApiClient: zApiClient as never,
    })

    const result = await resolve('mensagem normal, sem menção', {
      instanceId: 'INST-A',
      zApiToken: 'tok',
      groupId: 'grp-1',
    })

    expect(result).toBe('mensagem normal, sem menção')
    expect(zApiClient.getGroupMetadata).not.toHaveBeenCalled()
  })

  it('is a no-op when zApiToken is null', async () => {
    const redis = makeFakeRedis()
    const zApiClient = makeFakeZApiClient([
      { phone: '554788907930', lid: '159447120928786@lid' },
    ])
    const resolve = createResolveGroupMentions({
      redis: redis as never,
      zApiClient: zApiClient as never,
    })

    const result = await resolve('@159447120928786', {
      instanceId: 'INST-A',
      zApiToken: null,
      groupId: 'grp-1',
    })

    expect(result).toBe('@159447120928786')
    expect(zApiClient.getGroupMetadata).not.toHaveBeenCalled()
  })
})
