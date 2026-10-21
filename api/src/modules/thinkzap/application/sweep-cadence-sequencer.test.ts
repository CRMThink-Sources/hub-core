import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SweepCadenceSequencer } from './sweep-cadence-sequencer'

const { apiLogger } = vi.hoisted(() => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))
vi.mock('@/shared/infra/logger', () => ({ apiLogger }))

function makeSut(queues: Record<string, string[]>, live: string[]) {
  const cadence = {
    queuedLines: vi.fn(() => Promise.resolve(Object.keys(queues))),
    queuedTickets: vi.fn((line: string) => Promise.resolve(queues[line] ?? [])),
    dequeue: vi.fn((line: string, id: string) => {
      queues[line] = (queues[line] ?? []).filter(t => t !== id)

      return Promise.resolve()
    }),
  }
  const outbox = {
    findLiveIds: vi.fn((ids: string[]) =>
      Promise.resolve(new Set(ids.filter(id => live.includes(id)))),
    ),
  }
  const sweep = new SweepCadenceSequencer(cadence as never, outbox)
  return { sweep, cadence, outbox, queues }
}

describe('SweepCadenceSequencer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('não remove ticket vivo', async () => {
    const { sweep, cadence } = makeSut({ L1: ['a', 'b'] }, ['a', 'b'])

    await sweep.run()
    await sweep.run()

    expect(cadence.dequeue).not.toHaveBeenCalled()
  })

  it('remove o órfão só na segunda rodada seguida e registra o código', async () => {
    const { sweep, cadence, queues } = makeSut({ L1: ['a', 'b'] }, ['b'])

    expect(await sweep.run()).toEqual({ removed: 0 })
    expect(await sweep.run()).toEqual({ removed: 1 })

    expect(cadence.dequeue).toHaveBeenCalledWith('L1', 'a')
    expect(queues.L1).toEqual(['b'])
    expect(
      apiLogger.warn.mock.calls
        .concat(apiLogger.error.mock.calls, apiLogger.info.mock.calls)
        .some(
          ([fields]) =>
            (fields as { errorCode?: string }).errorCode ===
            'thinkzap.outbox.sequencer_stale_removed',
        ),
    ).toBe(true)
  })

  it('ticket que nasceu entre as rodadas não é removido', async () => {
    const live: string[] = []
    const { sweep, cadence } = makeSut({ L1: ['novo'] }, live)

    await sweep.run()
    live.push('novo') // a row foi gravada depois da primeira rodada
    await sweep.run()
    await sweep.run()

    expect(cadence.dequeue).not.toHaveBeenCalled()
  })

  it('pula linha com fila vazia', async () => {
    const { sweep, outbox } = makeSut({ L1: [] }, [])

    await sweep.run()

    expect(outbox.findLiveIds).not.toHaveBeenCalled()
  })
})
