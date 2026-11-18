import type {
  InsightsDeal,
  InsightsSession,
  LiveOperator,
} from '@/modules/thinkzap/application/insights/metrics/types'

/**
 * Fonte de dados do Insights. Existe para que o cálculo de métricas não saiba se
 * o portal lê pelo REST clássico (`lean`) ou pela Vibe API (`full`, com spam,
 * motivo de fechamento, nota e status de operador ao vivo).
 */
export interface InsightsDataSource {
  readonly mode: 'full' | 'lean'
  sessions(from: Date, to: Date): Promise<InsightsSession[]>
  directory(): Promise<{
    users: Record<string, string>
    userDept: Record<string, { id: number; name: string }>
  }>
  operators(): Promise<LiveOperator[]>
  deals(
    ids: number[],
    contactIds: number[],
    leadIds: number[],
  ): Promise<InsightsDeal[]>
}
