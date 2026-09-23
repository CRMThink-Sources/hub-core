import { describe, expect, it, vi } from 'vitest'
import type { LineItemConnectionTarget } from '@/modules/thinkzap/domain/ports/line-item-by-remote-id-finder.port'
import type { ThinkzapLineConnectedSyncJob } from '@/queue/thinkzap-line-connected-sync.queue'
import type {
  SyncLineConnectedFieldInput,
  SyncLineConnectedFieldOutcome,
} from '@/modules/thinkzap/application/sync-line-connected-field'
import { processLineConnectedSyncJob } from './thinkzap-line-connected-sync.processor'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const zapiJob = (
  event: ThinkzapLineConnectedSyncJob['event'],
): ThinkzapLineConnectedSyncJob => ({
  provider: 'ZAPI',
  remoteId: 'inst-1',
  event,
  momment: 1,
})

const makeDeps = (
  targets: LineItemConnectionTarget[],
  readZApiConnected = vi.fn().mockResolvedValue(true),
) => {
  const execute = vi.fn(({ current, connected }: SyncLineConnectedFieldInput) =>
    Promise.resolve<SyncLineConnectedFieldOutcome>(
      current === connected ? 'unchanged' : 'written',
    ),
  )
  const finder = {
    findLiveByZApiInstanceId: vi.fn().mockResolvedValue(targets),
    findLiveByHubMessageChannelId: vi.fn().mockResolvedValue(targets),
  }
  return {
    deps: { finder, sync: { execute }, readZApiConnected },
    execute,
    finder,
    readZApiConnected,
  }
}

describe('processLineConnectedSyncJob', () => {
  it('Z-API: grava o status lido ao vivo com o token do item', async () => {
    const { deps, execute, readZApiConnected } = makeDeps([
      { id: '10', connected: null, zApiInstanceToken: 'tok' },
    ])

    await expect(
      processLineConnectedSyncJob(zapiJob('connected'), deps),
    ).resolves.toEqual({ outcome: 'synced', written: 1, unchanged: 0 })
    expect(readZApiConnected).toHaveBeenCalledWith('inst-1', 'tok')
    expect(execute).toHaveBeenCalledWith({
      itemId: '10',
      current: null,
      connected: true,
    })
  })

  it('Z-API: job de desconexão atrasado não sobrescreve linha já reconectada', async () => {
    const { deps, execute } = makeDeps(
      [{ id: '10', connected: true, zApiInstanceToken: 'tok' }],
      vi.fn().mockResolvedValue(true),
    )

    await expect(
      processLineConnectedSyncJob(zapiJob('disconnected'), deps),
    ).resolves.toEqual({ outcome: 'synced', written: 0, unchanged: 1 })
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ connected: true }),
    )
  })

  it('Z-API: status indisponível cai no tipo do evento', async () => {
    const { deps, execute } = makeDeps(
      [{ id: '10', connected: true, zApiInstanceToken: 'tok' }],
      vi.fn().mockRejectedValue(new Error('timeout')),
    )

    await processLineConnectedSyncJob(zapiJob('disconnected'), deps)

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ connected: false }),
    )
  })

  it('HubMessage: usa o tipo do evento, sem consultar status', async () => {
    const { deps, execute, finder, readZApiConnected } = makeDeps([
      { id: '20', connected: true },
    ])

    await processLineConnectedSyncJob(
      {
        provider: 'HUBMESSAGE',
        remoteId: 'ch-1',
        event: 'disconnected',
        momment: 1,
      },
      deps,
    )

    expect(finder.findLiveByHubMessageChannelId).toHaveBeenCalledWith('ch-1')
    expect(readZApiConnected).not.toHaveBeenCalled()
    expect(execute).toHaveBeenCalledWith({
      itemId: '20',
      current: true,
      connected: false,
    })
  })

  it('item ausente é terminal e não grava', async () => {
    const { deps, execute } = makeDeps([])

    await expect(
      processLineConnectedSyncJob(zapiJob('connected'), deps),
    ).resolves.toEqual({ outcome: 'item-not-found' })
    expect(execute).not.toHaveBeenCalled()
  })

  it('mais de um item: grava em todos', async () => {
    const { deps, execute } = makeDeps([
      { id: '1', connected: null, zApiInstanceToken: 'a' },
      { id: '2', connected: true, zApiInstanceToken: 'b' },
    ])

    await expect(
      processLineConnectedSyncJob(zapiJob('connected'), deps),
    ).resolves.toEqual({ outcome: 'synced', written: 1, unchanged: 1 })
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('falha no Bitrix propaga para retentar', async () => {
    const { deps, execute } = makeDeps([
      { id: '1', connected: null, zApiInstanceToken: 'a' },
    ])
    execute.mockRejectedValueOnce(new Error('bitrix fora'))

    await expect(
      processLineConnectedSyncJob(zapiJob('connected'), deps),
    ).rejects.toThrow('bitrix fora')
  })
})
