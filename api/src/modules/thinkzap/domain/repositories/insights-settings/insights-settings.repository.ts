import type { InsightsConfig } from '@/modules/thinkzap/domain/insights-config'

export type InsightsSettings = {
  keyEnc: string | null
  last4: string | null
  portalId: string | null
  validatedAt: Date | null
  config: Partial<InsightsConfig> | null
}

export interface InsightsSettingsRepository {
  get(appId: string): Promise<InsightsSettings | null>
  saveKey(
    appId: string,
    k: {
      keyEnc: string
      last4: string
      portalId: string | null
      validatedAt: Date
    },
  ): Promise<void>
  /** Zera só a chave; a configuração do cliente é preservada. */
  removeKey(appId: string): Promise<void>
  saveConfig(appId: string, config: InsightsConfig): Promise<void>
}
