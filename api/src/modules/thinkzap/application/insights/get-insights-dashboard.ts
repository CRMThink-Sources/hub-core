import type { DashboardQuery, DashboardResult } from './insights-results.types'
import type { InsightsPanelReader, PanelResponse } from './read-insights-panel'

/**
 * Painel de Desempenho do período. Não calcula: devolve o resultado guardado
 * (5 min de validade, mais 30 min servível enquanto recalcula) ou dispara o
 * cálculo no worker e responde "calculando". O cálculo em si é o
 * `buildDashboard`, executado por `processInsightsCompute`.
 */
export class GetInsightsDashboard {
  constructor(private readonly deps: { reader: InsightsPanelReader }) {}

  execute(
    appId: string,
    q: DashboardQuery,
    traceKey?: string,
  ): Promise<PanelResponse<DashboardResult>> {
    return this.deps.reader.read<DashboardResult>(
      'dashboard',
      appId,
      q,
      traceKey,
    )
  }
}
