import { apiLogger } from '@/shared/infra/logger'
import type { GetInsightsConfig } from './get-insights-config'
import { buildDashboard } from './build-dashboard'
import {
  DASHBOARD_TTL_MS,
  insightsCacheKey,
  insightsResultCache,
  type InsightsResultCache,
} from './insights-result-cache'
import type { DashboardQuery, DashboardResult } from './insights-results.types'
import {
  runWithSourceFallback,
  type InsightsSourceFailureHandler,
  type InsightsSourceResolver,
} from './resolve-insights-source'

/** Painel do período: configuração + fonte do app + cálculo, com cache de 5 min. */
export class GetInsightsDashboard {
  constructor(
    private readonly deps: {
      getConfig: Pick<GetInsightsConfig, 'execute'>
      resolveSource: InsightsSourceResolver
      /** Chave revogada: refaz a leitura pela fonte que o resolver passar a dar. */
      onSourceFailure?: InsightsSourceFailureHandler
      cache?: InsightsResultCache
    },
  ) {}

  execute(appId: string, q: DashboardQuery): Promise<DashboardResult> {
    const cache = this.deps.cache ?? insightsResultCache
    const startedAt = Date.now()
    // Medição: sem carga própria, a resposta veio do cache (ou de uma carga
    // que já estava em andamento, caso em que o tempo mostra a espera).
    let loaded = false
    return cache
      .getOrLoad(
        appId,
        insightsCacheKey('dashboard', q),
        DASHBOARD_TTL_MS,
        async () => {
          loaded = true
          const cfg = await this.deps.getConfig.execute(appId)
          return runWithSourceFallback(appId, this.deps, source =>
            buildDashboard(source, cfg, q),
          )
        },
      )
      .finally(() => {
        apiLogger.info(
          {
            insightsTiming: 'dashboard.request',
            appId,
            ownLoad: loaded,
            totalMs: Date.now() - startedAt,
          },
          'Insights: requisição do painel respondida',
        )
      })
  }
}
