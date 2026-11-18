import type { InsightsSettingsRepository } from '@/modules/thinkzap/domain/repositories/insights-settings/insights-settings.repository'
import { getKeyProblem, type KeyProblem } from './key-health'

export type InsightsStatus = {
  mode: 'full' | 'lean'
  keyConfigured: boolean
  last4: string | null
  validatedAt: string | null
  keyProblem: KeyProblem | null
}

/**
 * `last4` e `validatedAt` só saem para quem administra a chave: usuários
 * comuns só precisam saber se o Insights está no modo completo ou enxuto.
 */
export class GetInsightsStatus {
  constructor(
    private readonly deps: { settings: InsightsSettingsRepository },
  ) {}

  async execute(
    appId: string,
    opts: { includeKeyDetails: boolean },
  ): Promise<InsightsStatus> {
    const row = await this.deps.settings.get(appId)
    const keyConfigured = !!row?.keyEnc
    const keyProblem = getKeyProblem(appId)
    return {
      // Chave com problema cai no clássico: o modo é enxuto, mesmo configurada.
      mode: keyConfigured && !keyProblem ? 'full' : 'lean',
      keyConfigured,
      last4: opts.includeKeyDetails ? (row?.last4 ?? null) : null,
      validatedAt: opts.includeKeyDetails
        ? (row?.validatedAt?.toISOString() ?? null)
        : null,
      keyProblem,
    }
  }
}
