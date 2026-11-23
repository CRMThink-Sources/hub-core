/**
 * Configuração do Insights por instalação. Fica num JSON parcial no banco:
 * campos ausentes caem nos padrões abaixo, assim novas opções não exigem
 * migração de dados.
 */
export type InsightsConfig = {
  refMin: number
  bhStart: number
  bhEnd: number
  bhDays: number[]
  bizOnly: boolean
  stuckDays: number
  dealWindowDays: number
  sources: string[]
}

export const INSIGHTS_CONFIG_DEFAULT: InsightsConfig = {
  refMin: 15,
  bhStart: 8,
  bhEnd: 18,
  bhDays: [1, 2, 3, 4, 5],
  bizOnly: true,
  stuckDays: 3,
  dealWindowDays: 30,
  sources: [],
}
