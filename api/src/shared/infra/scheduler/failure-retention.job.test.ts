import { describe, expect, it, vi } from 'vitest'

vi.mock('@/config/prisma', () => ({ prisma: {} }))
vi.mock('@/queue/redis-connection', () => ({ redisConnection: {} }))
vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { apiLogger } from '@/shared/infra/logger'
import {
  runFailureRetention,
  startFailureRetentionJob,
  type FailureRetentionJobDeps,
} from './failure-retention.job'

const NOW = new Date('2026-11-13T04:15:00Z')

function makeTarget(name: string, batches: number[] = [0]) {
  const queue = [...batches]
  return {
    name,
    deleteExpiredBatch: vi
      .fn<(cutoff: Date, limit: number) => Promise<number>>()
      .mockImplementation(() => Promise.resolve(queue.shift() ?? 0)),
  }
}

function makeDeps(overrides: Partial<FailureRetentionJobDeps> = {}) {
  let task: (() => Promise<void>) | undefined
  const schedule = vi.fn((_: string, fn: () => Promise<void>) => {
    task = fn
  })
  const lock = {
    tryAcquire: vi.fn().mockResolvedValue('tok'),
    release: vi.fn().mockResolvedValue(undefined),
  }

  const deps: FailureRetentionJobDeps = {
    enabled: true,
    retentionDays: 7,
    schedule,
    lock,
    targets: [makeTarget('tentativas'), makeTarget('envios com falha')],
    clock: () => NOW,
    batchSize: 2,
    maxBatches: 10,
    ...overrides,
  }

  return { deps, schedule, lock, tick: () => task?.() }
}

describe('startFailureRetentionJob', () => {
  it('desligado (padrão) não agenda', () => {
    const { deps, schedule } = makeDeps({ enabled: false })

    startFailureRetentionJob(deps)

    expect(schedule).not.toHaveBeenCalled()
  })

  it('ligado agenda uma vez por dia, de madrugada', () => {
    const { deps, schedule } = makeDeps()

    startFailureRetentionJob(deps)

    expect(schedule).toHaveBeenCalledWith('15 4 * * *', expect.any(Function))
  })

  it('o tick agendado executa o expurgo', async () => {
    const target = makeTarget('tentativas', [1])
    const { deps, tick } = makeDeps({ targets: [target] })
    startFailureRetentionJob(deps)

    await tick()

    expect(target.deleteExpiredBatch).toHaveBeenCalledTimes(1)
  })
})

describe('runFailureRetention', () => {
  it('apaga o que passou do prazo (corte = agora − dias) e informa as quantidades por tabela', async () => {
    const attempts = makeTarget('tentativas', [1])
    const inbound = makeTarget('falhas de recebimento', [3, 0])
    const { deps, lock } = makeDeps({
      targets: [attempts, inbound],
      batchSize: 10,
    })

    await runFailureRetention(deps)

    const cutoff = new Date('2026-11-06T04:15:00Z')
    expect(attempts.deleteExpiredBatch).toHaveBeenCalledWith(cutoff, 10)
    expect(inbound.deleteExpiredBatch).toHaveBeenCalledWith(cutoff, 10)
    expect(apiLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted: { tentativas: 1, 'falhas de recebimento': 3 },
      }),
      expect.stringContaining('Expurgo concluído'),
    )
    expect(lock.release).toHaveBeenCalledWith('tok')
  })

  it('o prazo configurado muda o corte', async () => {
    const target = makeTarget('tentativas')
    const { deps } = makeDeps({ targets: [target], retentionDays: 15 })

    await runFailureRetention(deps)

    expect(target.deleteExpiredBatch.mock.calls[0]![0]).toEqual(
      new Date('2026-10-29T04:15:00Z'),
    )
  })

  /** Muito volume vencido: vários lotes, nunca uma operação longa. */
  it('apaga em lotes sucessivos até um lote incompleto', async () => {
    const target = makeTarget('tentativas', [2, 2, 1])
    const { deps } = makeDeps({ targets: [target], batchSize: 2 })

    await runFailureRetention(deps)

    expect(target.deleteExpiredBatch).toHaveBeenCalledTimes(3)
    for (const [, limit] of target.deleteExpiredBatch.mock.calls) {
      expect(limit).toBe(2)
    }
  })

  it('o teto de lotes limita a rodada e o resto fica para a seguinte', async () => {
    const target = makeTarget('tentativas', [2, 2, 2, 2, 2, 2])
    const { deps } = makeDeps({
      targets: [target],
      batchSize: 2,
      maxBatches: 3,
    })

    await runFailureRetention(deps)

    expect(target.deleteExpiredBatch).toHaveBeenCalledTimes(3)
    expect(apiLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'tentativas', deleted: 6 }),
      expect.stringContaining('Teto de lotes'),
    )
  })

  it('duas instâncias: a que não pega o lock não apaga nem solta', async () => {
    const target = makeTarget('tentativas', [1])
    const { deps, lock } = makeDeps({ targets: [target] })
    lock.tryAcquire.mockResolvedValue(null)

    await runFailureRetention(deps)

    expect(target.deleteExpiredBatch).not.toHaveBeenCalled()
    expect(lock.release).not.toHaveBeenCalled()
  })

  /** Os lotes já apagados continuam apagados; a próxima rodada retoma de onde parou. */
  it('falha no meio: loga, mantém o que já saiu, segue para as outras tabelas e solta o lock', async () => {
    const broken = makeTarget('tentativas')
    broken.deleteExpiredBatch
      .mockResolvedValueOnce(2)
      .mockRejectedValueOnce(new Error('banco fora'))
    const next = makeTarget('envios com falha', [1])
    const { deps, lock } = makeDeps({ targets: [broken, next], batchSize: 2 })

    await expect(runFailureRetention(deps)).resolves.toBeUndefined()

    expect(apiLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'tentativas', deleted: 2 }),
      expect.stringContaining('retoma na próxima rodada'),
    )
    expect(next.deleteExpiredBatch).toHaveBeenCalledTimes(1)
    expect(apiLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted: { tentativas: 2, 'envios com falha': 1 },
      }),
      expect.stringContaining('Expurgo concluído'),
    )
    expect(lock.release).toHaveBeenCalledWith('tok')
  })

  it('erro ao pegar o lock não escapa do tick', async () => {
    const { deps, lock } = makeDeps()
    lock.tryAcquire.mockRejectedValue(new Error('redis fora'))

    await expect(runFailureRetention(deps)).resolves.toBeUndefined()
    expect(apiLogger.error).toHaveBeenCalled()
    expect(lock.release).not.toHaveBeenCalled()
  })

  it('falha ao soltar o lock só avisa (ele expira pelo TTL)', async () => {
    const { deps, lock } = makeDeps()
    lock.release.mockRejectedValue(new Error('redis fora'))

    await expect(runFailureRetention(deps)).resolves.toBeUndefined()
    expect(apiLogger.warn).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Falha ao soltar o lock'),
    )
  })
})
