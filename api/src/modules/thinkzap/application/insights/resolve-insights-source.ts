import type { InsightsDataSource } from '@/modules/thinkzap/domain/ports/insights-data-source.port'

/**
 * Escolhe de onde o Insights lê as conversas do app. Fica num ponto só para a
 * fase da Vibe API trocar a fonte (por chave configurada) sem mexer nos casos
 * de uso do painel.
 */
export type InsightsSourceResolver = (
  appId: string,
) => Promise<InsightsDataSource>
