import { beforeEach, describe, expect, it, vi } from 'vitest'

/** O módulo da fila abre conexão ao ser importado: conexão e fila são dubladas. */
vi.mock('./redis-connection', () => ({
  bullBaseOptions: { connection: {}, prefix: 'bull' },
}))

const { addMock, changePriority } = vi.hoisted(() => ({
  addMock: vi.fn<(...a: unknown[]) => Promise<unknown>>(() =>
    Promise.resolve({
      id: 'x',
      opts: {},
      changePriority: () => Promise.resolve(),
    }),
  ),
  changePriority: vi.fn(() => Promise.resolve()),
}))
vi.mock('bullmq', () => ({
  Queue: class {
    add = addMock
  },
}))
vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  INSIGHTS_COMPUTE_JOB,
  PREWARM_PRIORITY,
  enqueueInsightsCompute,
  insightsComputeJobId,
} from './insights-compute.queue'

const q = { from: '2026-11-12', to: '2026-11-18' }

describe('fila insights-compute', () => {
  beforeEach(() => addMock.mockClear())

  it('id estável para a mesma consulta, sem dois-pontos', () => {
    const id = insightsComputeJobId('dashboard', 'app-1', q)
    expect(id).toBe(insightsComputeJobId('dashboard', 'app-1', { ...q }))
    expect(id).not.toContain(':')
    // Mesmo com ":" no id do app (o BullMQ recusaria).
    expect(insightsComputeJobId('today', 'a:b', {})).not.toContain(':')
  })

  it('consultas, apps e painéis diferentes geram jobs diferentes', () => {
    const base = insightsComputeJobId('dashboard', 'app-1', q)
    expect(insightsComputeJobId('dashboard', 'app-2', q)).not.toBe(base)
    expect(insightsComputeJobId('today', 'app-1', q)).not.toBe(base)
    expect(
      insightsComputeJobId('dashboard', 'app-1', { ...q, to: '2026-11-19' }),
    ).not.toBe(base)
  })

  it('a ordem dos parâmetros e filtros em branco não mudam o id', () => {
    expect(
      insightsComputeJobId('dashboard', 'app-1', { to: q.to, from: q.from }),
    ).toBe(insightsComputeJobId('dashboard', 'app-1', { ...q, dept: '' }))
  })

  it('pedidos iguais vão com o mesmo jobId (o BullMQ colapsa)', async () => {
    const job = { kind: 'dashboard' as const, appId: 'app-1', query: q }
    await enqueueInsightsCompute({ ...job, traceKey: 't1' })
    await enqueueInsightsCompute({ ...job, traceKey: 't2' })

    const calls = addMock.mock.calls as unknown as unknown[][]
    expect(calls).toHaveLength(2)
    expect(calls[0]![0]).toBe(INSIGHTS_COMPUTE_JOB)
    expect((calls[0]![2] as { jobId: string }).jobId).toBe(
      (calls[1]![2] as { jobId: string }).jobId,
    )
  })

  it('remove o job concluído e não repete sozinho', async () => {
    await enqueueInsightsCompute({ kind: 'today', appId: 'app-1', query: {} })
    expect((addMock.mock.calls as unknown as unknown[][])[0]![2]).toMatchObject(
      // `removeOnFail` também: id fixo retido por um job falho bloquearia o
      // cálculo seguinte da mesma consulta (o BullMQ ignora `add` de id existente).
      { removeOnComplete: true, removeOnFail: true, attempts: 1 },
    )
  })

  describe('pré-aquecimento', () => {
    const job = { kind: 'dashboard' as const, appId: 'app-1', query: q }
    const optsOf = (i: number) =>
      (addMock.mock.calls as unknown as unknown[][])[i]![2] as {
        priority?: number
        jobId: string
      }

    it('entra com prioridade baixa; pedido de usuário, sem prioridade', async () => {
      await enqueueInsightsCompute({ ...job, origin: 'prewarm' })
      await enqueueInsightsCompute({ ...job, origin: 'request' })
      expect(optsOf(0).priority).toBe(PREWARM_PRIORITY)
      expect(optsOf(1).priority).toBeUndefined()
      // Mesma consulta, mesmo id: é isso que faz os dois colapsarem num só.
      expect(optsOf(0).jobId).toBe(optsOf(1).jobId)
    })

    it('usuário pedindo o que já esperava como pré-aquecimento sobe para a frente', async () => {
      changePriority.mockClear()
      addMock.mockResolvedValueOnce({
        id: 'x',
        opts: { priority: PREWARM_PRIORITY },
        changePriority,
      })
      await enqueueInsightsCompute({ ...job, origin: 'request' })
      expect(changePriority).toHaveBeenCalledWith({ priority: 0 })
    })

    it('não mexe na prioridade quando o job já era de usuário', async () => {
      changePriority.mockClear()
      addMock.mockResolvedValueOnce({ id: 'x', opts: {}, changePriority })
      await enqueueInsightsCompute({ ...job, origin: 'request' })
      expect(changePriority).not.toHaveBeenCalled()
    })

    it('job já em execução (não dá para subir) não derruba o pedido', async () => {
      addMock.mockResolvedValueOnce({
        id: 'x',
        opts: { priority: PREWARM_PRIORITY },
        changePriority: () => Promise.reject(new Error('não está na fila')),
      })
      await expect(
        enqueueInsightsCompute({ ...job, origin: 'request' }),
      ).resolves.toBeDefined()
    })
  })
})
