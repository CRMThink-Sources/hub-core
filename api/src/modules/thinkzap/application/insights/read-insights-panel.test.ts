import { describe, expect, it, vi } from 'vitest'
import { InsightsReadFailedError } from '@/modules/thinkzap/domain/errors/insights-read-failed.error'
import { MemoryInsightsKv } from '@/modules/thinkzap/infra/insights/memory-insights-kv'
import { GetInsightsDashboard } from './get-insights-dashboard'
import { GetInsightsToday } from './get-insights-today'
import { insightsQueryHash, makeInsightsKeys } from './insights-keys'
import {
  DASHBOARD_TTL_MS,
  InsightsResultStore,
  MAX_COMPUTE_MS,
  STALE_MAX_MS,
  TODAY_TTL_MS,
} from './insights-result-store'
import { InsightsPanelReader, LAST_OPEN_TTL_MS } from './read-insights-panel'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

function setup() {
  const clock = { t: 1_000_000 }
  const kv = new MemoryInsightsKv(() => clock.t)
  const store = new InsightsResultStore({
    kv,
    keys: makeInsightsKeys('bull'),
    now: () => clock.t,
  })
  const enqueue = vi.fn((_job: unknown) => Promise.resolve({}))
  const reader = new InsightsPanelReader({
    store,
    enqueue,
    now: () => clock.t,
  })
  return {
    clock,
    store,
    enqueue,
    reader,
    dashboard: new GetInsightsDashboard({ reader }),
    today: new GetInsightsToday({ reader }),
  }
}

const q = { from: '2026-11-12', to: '2026-11-18' }
const hashOf = (query: Record<string, unknown>) =>
  insightsQueryHash('dashboard', query)

describe('abertura do painel nunca espera o cálculo', () => {
  it('sem resultado: marca "calculando", enfileira e responde computing', async () => {
    const { dashboard, enqueue, store, clock } = setup()

    const r = await dashboard.execute('app-1', q, 'trace-1')

    expect(r).toEqual({ status: 'computing', startedAt: clock.t })
    expect(enqueue).toHaveBeenCalledTimes(1)
    expect(enqueue).toHaveBeenCalledWith({
      kind: 'dashboard',
      appId: 'app-1',
      query: q,
      traceKey: 'trace-1',
    })
    expect(await store.getState('app-1', 'dashboard', hashOf(q))).toEqual({
      status: 'computing',
      startedAt: clock.t,
    })
  })

  it('resultado recente: 200 sem iniciar cálculo', async () => {
    const { dashboard, enqueue, store, clock } = setup()
    await store.setResult('app-1', 'dashboard', hashOf(q), { mode: 'full' }, 0)
    clock.t += DASHBOARD_TTL_MS - 1

    const r = await dashboard.execute('app-1', q)

    expect(r).toEqual({
      status: 'ready',
      data: { mode: 'full' },
      stale: false,
    })
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('vencido há menos de 30 min: serve na hora, marcado como desatualizado, e recalcula', async () => {
    const { dashboard, enqueue, store, clock } = setup()
    await store.setResult('app-1', 'dashboard', hashOf(q), { mode: 'full' }, 0)
    clock.t += DASHBOARD_TTL_MS + 10 * 60_000

    const r = await dashboard.execute('app-1', q)

    expect(r).toEqual({
      status: 'ready',
      data: { mode: 'full' },
      stale: true,
    })
    expect(enqueue).toHaveBeenCalledTimes(1)
  })

  it('vencido e já recalculando: serve o antigo sem enfileirar de novo', async () => {
    const { dashboard, enqueue, store, clock } = setup()
    await store.setResult('app-1', 'dashboard', hashOf(q), 'x', 0)
    clock.t += DASHBOARD_TTL_MS + 1000
    await dashboard.execute('app-1', q)
    await dashboard.execute('app-1', q)
    expect(enqueue).toHaveBeenCalledTimes(1)
  })

  it('velho demais (além da janela stale): trata como inexistente e responde computing', async () => {
    const { dashboard, store, clock } = setup()
    await store.setResult('app-1', 'dashboard', hashOf(q), 'x', 0)
    clock.t += DASHBOARD_TTL_MS + STALE_MAX_MS + 1

    const r = await dashboard.execute('app-1', q)
    expect(r.status).toBe('computing')
  })

  it('o "Agora" vale 1 min', async () => {
    const { today, enqueue, store, clock } = setup()
    const hash = insightsQueryHash('today', {})
    await store.setResult('app-1', 'today', hash, { mode: 'lean' }, 0)
    clock.t += TODAY_TTL_MS - 1
    expect((await today.execute('app-1', {})).status).toBe('ready')
    expect(enqueue).not.toHaveBeenCalled()

    clock.t += 2
    const stale = await today.execute('app-1', {})
    expect(stale).toMatchObject({ status: 'ready', stale: true })
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'today', appId: 'app-1' }),
    )
  })

  it('"Agora" com tudo frio: computing', async () => {
    const { today, enqueue } = setup()
    expect((await today.execute('app-1', {})).status).toBe('computing')
    expect(enqueue).toHaveBeenCalledTimes(1)
  })
})

describe('um único cálculo por consulta', () => {
  it('repetir a consulta durante o cálculo devolve computing sem enfileirar outro', async () => {
    const { dashboard, enqueue } = setup()
    const a = await dashboard.execute('app-1', q)
    const b = await dashboard.execute('app-1', { to: q.to, from: q.from })
    expect(a.status).toBe('computing')
    expect(b).toEqual(a)
    expect(enqueue).toHaveBeenCalledTimes(1)
  })

  it('consultas, apps e painéis diferentes têm cálculos independentes', async () => {
    const { dashboard, today, enqueue } = setup()
    await dashboard.execute('app-1', { dept: '1' })
    await dashboard.execute('app-1', { dept: '2' })
    await dashboard.execute('app-2', { dept: '1' })
    await today.execute('app-1', {})
    expect(enqueue).toHaveBeenCalledTimes(4)
  })

  it('filtro em branco não gera consulta nova', async () => {
    const { dashboard, enqueue } = setup()
    await dashboard.execute('app-1', { ...q, dept: '' })
    await dashboard.execute('app-1', q)
    expect(enqueue).toHaveBeenCalledTimes(1)
  })
})

describe('consulta do andamento', () => {
  it('quando o cálculo conclui, a mesma consulta devolve o painel', async () => {
    const { dashboard, store } = setup()
    expect((await dashboard.execute('app-1', q)).status).toBe('computing')

    await store.setResult('app-1', 'dashboard', hashOf(q), { ok: 1 }, 0)
    await store.clearState('app-1', 'dashboard', hashOf(q))

    expect(await dashboard.execute('app-1', q)).toMatchObject({
      status: 'ready',
      data: { ok: 1 },
    })
  })

  it('cálculo que falhou: a consulta recebe o erro e a abertura seguinte recalcula', async () => {
    const { dashboard, store, enqueue } = setup()
    await dashboard.execute('app-1', q)
    await store.markFailed('app-1', 'dashboard', hashOf(q))

    await expect(dashboard.execute('app-1', q)).rejects.toMatchObject({
      name: 'InsightsReadFailedError',
      reason: 'failed',
    })
    expect(enqueue).toHaveBeenCalledTimes(1)

    const next = await dashboard.execute('app-1', q)
    expect(next.status).toBe('computing')
    expect(enqueue).toHaveBeenCalledTimes(2)
  })

  it('cálculo travado além do prazo máximo: erro em vez de computing', async () => {
    const { dashboard, clock } = setup()
    await dashboard.execute('app-1', q)

    clock.t += MAX_COMPUTE_MS - 1
    expect((await dashboard.execute('app-1', q)).status).toBe('computing')

    clock.t += 2
    await expect(dashboard.execute('app-1', q)).rejects.toMatchObject({
      reason: 'timeout',
    })
    // A abertura seguinte inicia outro cálculo.
    expect((await dashboard.execute('app-1', q)).status).toBe('computing')
  })

  it('falha do worker não estraga a resposta de um resultado desatualizado', async () => {
    const { dashboard, store, clock } = setup()
    await store.setResult('app-1', 'dashboard', hashOf(q), 'velho', 0)
    clock.t += DASHBOARD_TTL_MS + 1000
    await store.markFailed('app-1', 'dashboard', hashOf(q))

    const r = await dashboard.execute('app-1', q)
    expect(r).toMatchObject({ status: 'ready', data: 'velho', stale: true })
  })

  it('o erro de falha é o do domínio', async () => {
    const { dashboard, store } = setup()
    await dashboard.execute('app-1', q)
    await store.markFailed('app-1', 'dashboard', hashOf(q))
    await expect(dashboard.execute('app-1', q)).rejects.toBeInstanceOf(
      InsightsReadFailedError,
    )
  })

  it('sem conseguir enfileirar, desfaz a marca de "calculando" e propaga', async () => {
    const { dashboard, enqueue, store } = setup()
    enqueue.mockRejectedValueOnce(new Error('redis fora'))

    await expect(dashboard.execute('app-1', q)).rejects.toThrow('redis fora')

    expect(await store.getState('app-1', 'dashboard', hashOf(q))).toBeNull()
    // A próxima tentativa não fica presa num "calculando" sem job.
    expect((await dashboard.execute('app-1', q)).status).toBe('computing')
    expect(enqueue).toHaveBeenCalledTimes(2)
  })
})

describe('registro de abertura (pré-aquecimento)', () => {
  it('a abertura marca o app como usado recentemente, por 7 dias', async () => {
    const { dashboard, store, clock } = setup()
    await dashboard.execute('app-1', q)
    expect(await store.listRecentlyOpened()).toEqual(['app-1'])

    clock.t += LAST_OPEN_TTL_MS + 1
    expect(await store.listRecentlyOpened()).toEqual([])
  })

  it('falha ao registrar a abertura não derruba a resposta', async () => {
    const { reader, store } = setup()
    vi.spyOn(store, 'touchLastOpen').mockRejectedValue(new Error('redis'))
    const r = await reader.read('dashboard', 'app-1', q)
    expect(r.status).toBe('computing')
  })
})
