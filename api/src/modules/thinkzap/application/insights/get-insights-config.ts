import {
  INSIGHTS_CONFIG_DEFAULT,
  type InsightsConfig,
} from '@/modules/thinkzap/domain/insights-config'
import type { InsightsSettingsRepository } from '@/modules/thinkzap/domain/repositories/insights-settings/insights-settings.repository'

/**
 * Configuração do Insights do portal. O banco guarda um JSON parcial: o que
 * falta vem do padrão, para opções novas valerem sem migrar dados.
 */
export class GetInsightsConfig {
  constructor(
    private readonly deps: { settings: InsightsSettingsRepository },
  ) {}

  async execute(appId: string): Promise<InsightsConfig> {
    const row = await this.deps.settings.get(appId)
    return { ...INSIGHTS_CONFIG_DEFAULT, ...(row?.config ?? {}) }
  }
}
