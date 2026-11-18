import type { GetInsightsConfig } from './get-insights-config'
import { buildDashboard } from './build-dashboard'
import {
  DASHBOARD_TTL_MS,
  insightsCacheKey,
  insightsResultCache,
  type InsightsResultCache,
} from './insights-result-cache'
import type { DashboardQuery, DashboardResult } from './insights-results.types'
import type { InsightsSourceResolver } from './resolve-insights-source'

/** Painel do período: configuração + fonte do app + cálculo, com cache de 5 min. */
export class GetInsightsDashboard {
  constructor(
    private readonly deps: {
      getConfig: Pick<GetInsightsConfig, 'execute'>
      resolveSource: InsightsSourceResolver
      cache?: InsightsResultCache
    },
  ) {}

  execute(appId: string, q: DashboardQuery): Promise<DashboardResult> {
    const cache = this.deps.cache ?? insightsResultCache
    return cache.getOrLoad(
      appId,
      insightsCacheKey('dashboard', q),
      DASHBOARD_TTL_MS,
      async () => {
        const [cfg, source] = await Promise.all([
          this.deps.getConfig.execute(appId),
          this.deps.resolveSource(appId),
        ])
        return buildDashboard(source, cfg, q)
      },
    )
  }
}
