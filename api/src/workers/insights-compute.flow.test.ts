import { describe, expect, it, vi } from 'vitest'
import { makeInsightsKeys } from '@/modules/thinkzap/application/insights/insights-keys'
import { InsightsResultStore } from '@/modules/thinkzap/application/insights/insights-result-store'
import {
  fakeSource,
  session,
} from '@/modules/thinkzap/application/insights/insights-test-helpers'
import { InsightsPanelReader } from '@/modules/thinkzap/application/insights/read-insights-panel'
import {
  INSIGHTS_CONFIG_DEFAULT,
  type InsightsConfig,
} from '@/modules/thinkzap/domain/insights-config'
import { MemoryInsightsKv } from '@/modules/thinkzap/infra/insights/memory-insights-kv'
import type { InsightsComputeJob } from '@/queue/insights-compute.queue'
import { processInsightsCompute } from './insights-compute.processor'

vi.mock('@/shared/infra/logger', () => {
  const l = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => l,
  }
  return { workerLogger: l, apiLogger: l }
})

/**
 * Fluxo completo sem Redis nem fila reais: o leitor (API) enfileira, o
 * processor (worker) calcula e guarda, e o leitor entrega. É o que prova que a
 * invalidação vale entre os dois "processos".
 */
function setup() {
  const kv = new MemoryInsightsKv()
  const store = new InsightsResultStore({ kv, keys: makeInsightsKeys('bull') })
  const queue: InsightsComputeJob[] = []
  const reader = new InsightsPanelReader({
    store,
    enqueue: job => {
      queue.push(job)
      return Promise.resolve({})
    },
  })
  const { source } = fakeSource({
    mode: 'full',
    sessions: [
      session({
        id: 1,
        dateCreate: '2026-11-10T13:00:00.000Z',
        status: 'closed',
      }),
    ],
  })
  // Config "no banco": o processor a lê a cada cálculo.
  let config: InsightsConfig = INSIGHTS_CONFIG_DEFAULT
  const run = (job: InsightsComputeJob, onResolve?: () => Promise<void>) =>
    processInsightsCompute(job, {
      store,
      getConfig: () => Promise.resolve(config),
      makeSources: () => ({
        resolve: async () => {
          await onResolve?.()
          return source
        },
        onSourceFailure: () => false,
      }),
    })
  return {
    store,
    reader,
    queue,
    run,
    setConfig: (c: InsightsConfig) => {
      config = c
    },
  }
}

const q = { from: '2026-11-10', to: '2026-11-10' }

describe('fluxo leitor → worker → leitor', () => {
  it('a primeira abertura calcula em segundo plano; a seguinte recebe o painel', async () => {
    const { reader, queue, run } = setup()

    const first = await reader.read('dashboard', 'app-1', q)
    expect(first.status).toBe('computing')
    expect(queue).toHaveLength(1)

    await run(queue[0]!)

    const second = await reader.read<{ kpi: { total: number } }>(
      'dashboard',
      'app-1',
      q,
    )
    expect(second).toMatchObject({ status: 'ready', stale: false })
    expect(queue).toHaveLength(1)
  })

  it('configuração salva durante o cálculo: o resultado velho não é guardado e a abertura seguinte calcula com a nova', async () => {
    const { reader, queue, run, store, setConfig } = setup()
    setConfig({ ...INSIGHTS_CONFIG_DEFAULT, refMin: 15 })
    await reader.read('dashboard', 'app-1', q)

    // O admin salva a configuração no meio da leitura do worker.
    await run(queue[0]!, async () => {
      setConfig({ ...INSIGHTS_CONFIG_DEFAULT, refMin: 30 })
      await store.invalidateApp('app-1')
    })

    // Nada foi guardado (foi calculado com a configuração antiga)...
    const after = await reader.read('dashboard', 'app-1', q)
    expect(after.status).toBe('computing')
    expect(queue).toHaveLength(2)

    // ...e o novo cálculo usa a configuração nova.
    await run(queue[1]!)
    const done = await reader.read<{ period: { slaMin: number } }>(
      'dashboard',
      'app-1',
      q,
    )
    expect(done).toMatchObject({ status: 'ready' })
    if (done.status === 'ready') expect(done.data.period.slaMin).toBe(30)
  })

  it('salvar a configuração apaga o resultado já guardado', async () => {
    const { reader, queue, run, store } = setup()
    await reader.read('dashboard', 'app-1', q)
    await run(queue[0]!)
    expect((await reader.read('dashboard', 'app-1', q)).status).toBe('ready')

    await store.invalidateApp('app-1')

    expect((await reader.read('dashboard', 'app-1', q)).status).toBe(
      'computing',
    )
    expect(queue).toHaveLength(2)
  })

  it('cálculo que falha: a tela recebe o erro e a abertura seguinte calcula de novo', async () => {
    const { reader, queue, store } = setup()
    await reader.read('dashboard', 'app-1', q)
    await expect(
      processInsightsCompute(queue[0]!, {
        store,
        getConfig: () => Promise.reject(new Error('banco fora')),
        makeSources: () => ({
          resolve: () => Promise.reject(new Error('nunca chega')),
          onSourceFailure: () => false,
        }),
      }),
    ).rejects.toThrow('banco fora')

    await expect(reader.read('dashboard', 'app-1', q)).rejects.toMatchObject({
      name: 'InsightsReadFailedError',
    })
    expect((await reader.read('dashboard', 'app-1', q)).status).toBe(
      'computing',
    )
    expect(queue).toHaveLength(2)
  })

  it('o "Agora" segue o mesmo fluxo', async () => {
    const { reader, queue, run } = setup()
    expect((await reader.read('today', 'app-1', {})).status).toBe('computing')
    await run(queue[0]!)
    expect((await reader.read('today', 'app-1', {})).status).toBe('ready')
  })
})
