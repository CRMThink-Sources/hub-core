import type {
  InsightsDeal,
  InsightsSession,
  LiveOperator,
} from '@/modules/thinkzap/application/insights/metrics/types'

/** Canal aberto com a meta de 1ª resposta configurada no próprio Bitrix. */
export type InsightsChannelConfig = {
  id: number
  name: string
  kpiFirstAnswerTime: number | string | null
}

/**
 * Fonte de dados do Insights. Existe para que o cálculo de métricas não saiba se
 * o portal lê pelo REST clássico (`lean`) ou pela Vibe API (`full`, com spam,
 * motivo de fechamento, nota e status de operador ao vivo).
 */
export interface InsightsDataSource {
  readonly mode: 'full' | 'lean'
  /** Domínio do portal, mostrado no cabeçalho do painel. */
  readonly portal?: string | null
  /**
   * Metas dos canais (`/openline-configs`). Só a Vibe API expõe; sem ela o
   * painel mostra `channelSla: null`, como o original no REST clássico.
   */
  channelConfigs?(): Promise<InsightsChannelConfig[]>
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
