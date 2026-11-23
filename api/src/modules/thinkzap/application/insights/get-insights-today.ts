import type { TodayQuery, TodayResult } from './insights-results.types'
import type { InsightsPanelReader, PanelResponse } from './read-insights-panel'

/**
 * Painel "Agora" (a aba de abertura padrão). Mesmo contrato do Desempenho:
 * resultado guardado (1 min de validade) ou "calculando" enquanto o worker lê as
 * conversas abertas. O cálculo em si é o `buildToday`.
 */
export class GetInsightsToday {
  constructor(private readonly deps: { reader: InsightsPanelReader }) {}

  execute(
    appId: string,
    q: TodayQuery,
    traceKey?: string,
  ): Promise<PanelResponse<TodayResult>> {
    return this.deps.reader.read<TodayResult>('today', appId, q, traceKey)
  }
}
