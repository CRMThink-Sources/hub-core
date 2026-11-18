import type { GetInsightsConfig } from './get-insights-config'
import { buildToday } from './build-today'
import {
  TODAY_TTL_MS,
  insightsCacheKey,
  insightsResultCache,
  type InsightsResultCache,
} from './insights-result-cache'
import type { TodayQuery, TodayResult } from './insights-results.types'
import type { InsightsSourceResolver } from './resolve-insights-source'

/** Painel "hoje": cache curto (60 s), pois o objetivo é ver o que está aberto agora. */
export class GetInsightsToday {
  constructor(
    private readonly deps: {
      getConfig: Pick<GetInsightsConfig, 'execute'>
      resolveSource: InsightsSourceResolver
      cache?: InsightsResultCache
    },
  ) {}

  execute(appId: string, q: TodayQuery): Promise<TodayResult> {
    const cache = this.deps.cache ?? insightsResultCache
    return cache.getOrLoad(
      appId,
      insightsCacheKey('today', q),
      TODAY_TTL_MS,
      async () => {
        const [cfg, source] = await Promise.all([
          this.deps.getConfig.execute(appId),
          this.deps.resolveSource(appId),
        ])
        return buildToday(source, cfg, q)
      },
    )
  }
}
