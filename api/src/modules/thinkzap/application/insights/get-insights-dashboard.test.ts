import { describe, expect, it, vi } from 'vitest'
import { INSIGHTS_CONFIG_DEFAULT } from '@/modules/thinkzap/domain/insights-config'
import { GetInsightsDashboard } from './get-insights-dashboard'
import { GetInsightsToday } from './get-insights-today'
import type { GetInsightsConfig } from './get-insights-config'
import { InsightsResultCache } from './insights-result-cache'
import { fakeSource } from './insights-test-helpers'
import type { InsightsSourceResolver } from './resolve-insights-source'

const setup = () => {
  let now = 0
  const cache = new InsightsResultCache(() => now)
  const { source } = fakeSource({ sessions: [] })
  const resolveSource = vi.fn<InsightsSourceResolver>(() =>
    Promise.resolve(source),
  )
  const getConfig = {
    execute: vi.fn<GetInsightsConfig['execute']>(() =>
      Promise.resolve(INSIGHTS_CONFIG_DEFAULT),
    ),
  }
  return {
    cache,
    resolveSource,
    advance: (ms: number) => (now += ms),
    deps: { cache, resolveSource, getConfig },
  }
}

describe('GetInsightsDashboard', () => {
  it('calcula com a fonte do app e devolve o mode da fonte', async () => {
    const { deps, resolveSource } = setup()
    const r = await new GetInsightsDashboard(deps).execute('app-1', {})
    expect(resolveSource).toHaveBeenCalledWith('app-1')
    expect(r.mode).toBe('lean')
  })

  it('serve do cache por 5 min e recalcula depois', async () => {
    const { deps, resolveSource, advance } = setup()
    const uc = new GetInsightsDashboard(deps)
    await uc.execute('app-1', { from: '2026-11-01', to: '2026-11-10' })
    advance(5 * 60_000 - 1)
    await uc.execute('app-1', { to: '2026-11-10', from: '2026-11-01' })
    expect(resolveSource).toHaveBeenCalledTimes(1)
    advance(2)
    await uc.execute('app-1', { from: '2026-11-01', to: '2026-11-10' })
    expect(resolveSource).toHaveBeenCalledTimes(2)
  })

  it('consulta diferente ou app diferente não compartilha cache', async () => {
    const { deps, resolveSource } = setup()
    const uc = new GetInsightsDashboard(deps)
    await uc.execute('app-1', { dept: '1' })
    await uc.execute('app-1', { dept: '2' })
    await uc.execute('app-2', { dept: '1' })
    expect(resolveSource).toHaveBeenCalledTimes(3)
  })

  it('invalidar o app (ao salvar config) força recalcular', async () => {
    const { deps, resolveSource, cache } = setup()
    const uc = new GetInsightsDashboard(deps)
    await uc.execute('app-1', {})
    cache.invalidate('app-1')
    await uc.execute('app-1', {})
    expect(resolveSource).toHaveBeenCalledTimes(2)
  })
})

describe('GetInsightsToday', () => {
  it('cacheia por 60 s', async () => {
    const { deps, resolveSource, advance } = setup()
    const uc = new GetInsightsToday(deps)
    const r = await uc.execute('app-1', {})
    expect(r.mode).toBe('lean')
    advance(59_999)
    await uc.execute('app-1', {})
    expect(resolveSource).toHaveBeenCalledTimes(1)
    advance(2)
    await uc.execute('app-1', {})
    expect(resolveSource).toHaveBeenCalledTimes(2)
  })
})
