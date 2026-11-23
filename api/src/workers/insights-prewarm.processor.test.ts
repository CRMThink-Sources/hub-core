import { describe, expect, it, vi } from 'vitest'
import { defaultDashboardQuery } from '@/modules/thinkzap/application/insights/default-queries'
import {
  insightsQueryHash,
  makeInsightsKeys,
} from '@/modules/thinkzap/application/insights/insights-keys'
import {
  InsightsResultStore,
  STALE_MAX_MS,
  TODAY_TTL_MS,
  DASHBOARD_TTL_MS,
} from '@/modules/thinkzap/application/insights/insights-result-store'
import { LAST_OPEN_TTL_MS } from '@/modules/thinkzap/application/insights/read-insights-panel'
import { INSIGHTS_CONFIG_DEFAULT } from '@/modules/thinkzap/domain/insights-config'
import { MemoryInsightsKv } from '@/modules/thinkzap/infra/insights/memory-insights-kv'
import type { InsightsComputeJob } from '@/queue/insights-compute.queue'
import { processInsightsPrewarm } from './insights-prewarm.processor'

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

const TICK = 10 * 60_000

function setup() {
  const clock = { t: Date.parse('2026-11-18T15:00:00Z') }
  const kv = new MemoryInsightsKv(() => clock.t)
  const store = new InsightsResultStore({
    kv,
    keys: makeInsightsKeys('bull'),
    now: () => clock.t,
  })
  const jobs: InsightsComputeJob[] = []
  const enqueue = vi.fn((job: InsightsComputeJob) => {
    jobs.push(job)
    return Promise.resolve({})
  })
  const getConfig = vi.fn((_appId: string) =>
    Promise.resolve(INSIGHTS_CONFIG_DEFAULT),
  )
  const run = () =>
    processInsightsPrewarm({
      store,
      getConfig,
      enqueue,
      now: () => clock.t,
      tickMs: TICK,
    })
  return { clock, store, jobs, enqueue, getConfig, run }
}

describe('processInsightsPrewarm', () => {
  it('app que abriu o Insights: calcula o "Agora" e o Desempenho padrão, com prioridade de pré-aquecimento', async () => {
    const { store, jobs, run, clock } = setup()
    await store.touchLastOpen('app-1', LAST_OPEN_TTL_MS)

    const out = await run()

    expect(out).toEqual({ apps: 1, enqueued: 2 })
    expect(jobs.map(j => j.kind).sort()).toEqual(['dashboard', 'today'])
    expect(jobs.every(j => j.origin === 'prewarm' && j.appId === 'app-1')).toBe(
      true,
    )
    const dash = jobs.find(j => j.kind === 'dashboard')!
    expect(dash.query).toEqual(defaultDashboardQuery(clock.t))
    expect(dash.query).toMatchObject({
      from: '2026-11-12',
      to: '2026-11-18',
      g: 'total',
      sg: 'day',
    })
  })

  it('a consulta pré-aquecida tem a mesma chave da que a tela envia ao abrir', async () => {
    const { store, jobs, run } = setup()
    await store.touchLastOpen('app-1', LAST_OPEN_TTL_MS)
    await run()

    // O que `insights/page.tsx` envia: período padrão, filtros vazios (que o
    // `dashboardPath` já tira da URL), `g` e `sg` iniciais; e `alertMin` do
    // `refMin` do app para o "Agora".
    const fromScreen = {
      from: '2026-11-12',
      to: '2026-11-18',
      g: 'total',
      sg: 'day',
    }
    const dash = jobs.find(j => j.kind === 'dashboard')!
    const today = jobs.find(j => j.kind === 'today')!
    expect(insightsQueryHash('dashboard', dash.query)).toBe(
      insightsQueryHash('dashboard', fromScreen),
    )
    expect(insightsQueryHash('today', today.query)).toBe(
      insightsQueryHash('today', {
        alertMin: String(INSIGHTS_CONFIG_DEFAULT.refMin),
      }),
    )
  })

  it('o "Agora" usa o tempo de referência configurado do app', async () => {
    const { store, jobs, run, getConfig } = setup()
    getConfig.mockResolvedValue({ ...INSIGHTS_CONFIG_DEFAULT, refMin: 40 })
    await store.touchLastOpen('app-1', LAST_OPEN_TTL_MS)
    await run()
    expect(jobs.find(j => j.kind === 'today')!.query).toEqual({
      alertMin: '40',
    })
  })

  it('app sem abertura recente não é pré-aquecido', async () => {
    const { store, jobs, run, clock } = setup()
    await store.touchLastOpen('antigo', LAST_OPEN_TTL_MS)
    clock.t += LAST_OPEN_TTL_MS + 1
    await store.touchLastOpen('recente', LAST_OPEN_TTL_MS)

    await run()

    expect(new Set(jobs.map(j => j.appId))).toEqual(new Set(['recente']))
  })

  it('nenhum app ativo: não enfileira nada', async () => {
    const { run, enqueue } = setup()
    expect(await run()).toEqual({ apps: 0, enqueued: 0 })
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('resultado ainda longe de sair da janela servível: não recalcula', async () => {
    const { store, jobs, run } = setup()
    await store.touchLastOpen('app-1', LAST_OPEN_TTL_MS)
    const q = defaultDashboardQuery(Date.parse('2026-11-18T15:00:00Z'))
    await store.setResult(
      'app-1',
      'dashboard',
      insightsQueryHash('dashboard', q),
      {},
      0,
    )
    await store.setResult(
      'app-1',
      'today',
      insightsQueryHash('today', {
        alertMin: String(INSIGHTS_CONFIG_DEFAULT.refMin),
      }),
      {},
      0,
    )

    await run()

    expect(jobs).toEqual([])
  })

  it('resultado que sai da janela antes do próximo tick: recalcula (só esse)', async () => {
    const { store, jobs, run, clock } = setup()
    await store.touchLastOpen('app-1', LAST_OPEN_TTL_MS)
    const dashHash = insightsQueryHash(
      'dashboard',
      defaultDashboardQuery(clock.t),
    )
    const todayHash = insightsQueryHash('today', {
      alertMin: String(INSIGHTS_CONFIG_DEFAULT.refMin),
    })
    await store.setResult('app-1', 'dashboard', dashHash, {}, 0)
    await store.setResult('app-1', 'today', todayHash, {}, 0)

    // O "Agora" (validade 1 min) está a menos de um tick de sumir; o
    // Desempenho (5 min) ainda tem folga.
    clock.t += TODAY_TTL_MS + STALE_MAX_MS - TICK
    expect(clock.t - Date.parse('2026-11-18T15:00:00Z')).toBeLessThan(
      DASHBOARD_TTL_MS + STALE_MAX_MS - TICK,
    )
    await run()

    expect(jobs.map(j => j.kind)).toEqual(['today'])
  })

  it('resultado que já saiu da janela: recalcula', async () => {
    const { store, jobs, run, clock } = setup()
    await store.touchLastOpen('app-1', LAST_OPEN_TTL_MS)
    await store.setResult(
      'app-1',
      'dashboard',
      insightsQueryHash('dashboard', defaultDashboardQuery(clock.t)),
      {},
      0,
    )
    clock.t += DASHBOARD_TTL_MS + STALE_MAX_MS + 1

    await run()

    expect(jobs.map(j => j.kind).sort()).toEqual(['dashboard', 'today'])
  })

  it('falha de um app não impede o pré-aquecimento dos demais', async () => {
    const { store, jobs, run, getConfig } = setup()
    await store.touchLastOpen('ruim', LAST_OPEN_TTL_MS)
    await store.touchLastOpen('bom', LAST_OPEN_TTL_MS)
    getConfig.mockImplementation(appId =>
      appId === 'ruim'
        ? Promise.reject(new Error('banco fora'))
        : Promise.resolve(INSIGHTS_CONFIG_DEFAULT),
    )

    const out = await run()

    expect(new Set(jobs.map(j => j.appId))).toEqual(new Set(['bom']))
    expect(out).toEqual({ apps: 2, enqueued: 2 })
  })

  it('falha ao enfileirar um painel não derruba o job nem os outros apps', async () => {
    const { store, run, enqueue, jobs } = setup()
    await store.touchLastOpen('a', LAST_OPEN_TTL_MS)
    await store.touchLastOpen('b', LAST_OPEN_TTL_MS)
    enqueue.mockRejectedValueOnce(new Error('redis'))

    await expect(run()).resolves.toBeDefined()
    expect(jobs.some(j => j.appId === 'b')).toBe(true)
  })
})
