import {
  INSIGHTS_CONFIG_DEFAULT,
  type InsightsConfig,
} from '@/modules/thinkzap/domain/insights-config'
import type { InsightsSettingsRepository } from '@/modules/thinkzap/domain/repositories/insights-settings/insights-settings.repository'
import { GetInsightsConfig } from './get-insights-config'

const KEYS = Object.keys(INSIGHTS_CONFIG_DEFAULT) as (keyof InsightsConfig)[]

// Valor não numérico (ex.: texto vazio vindo do formulário) viraria NaN e
// quebraria o cálculo do horário comercial; nesse caso vale o padrão.
const num = (x: unknown, fallback: number) => {
  const n = Number(x)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Mesmas normalizações do `saveConfig` do original. `refMin` e `stuckDays`
 * usam `Number(x) || padrão`, então 0 volta ao padrão (15 e 3), mas negativo
 * vira o mínimo 1 — o original faz assim e o front já conta com isso.
 */
export function normalizeInsightsConfig(
  base: InsightsConfig,
  patch: Record<string, unknown>,
): InsightsConfig {
  const n: Record<string, unknown> = { ...base }
  // Só chaves conhecidas: o JSON vai para o banco e não pode crescer com lixo.
  for (const k of KEYS) if (patch[k] !== undefined) n[k] = patch[k]
  const bhStart = Math.min(23, Math.max(0, num(n.bhStart, base.bhStart)))
  return {
    refMin: Math.max(1, Number(n.refMin) || 15),
    bhStart,
    bhEnd: Math.min(24, Math.max(bhStart + 1, num(n.bhEnd, base.bhEnd))),
    bhDays: (Array.isArray(n.bhDays) ? (n.bhDays as unknown[]) : [])
      .map(Number)
      .filter(d => d >= 0 && d <= 6),
    bizOnly: !!n.bizOnly,
    stuckDays: Math.max(1, Number(n.stuckDays) || 3),
    dealWindowDays: Math.max(0, Number(n.dealWindowDays) || 0),
    sources: (Array.isArray(n.sources) ? (n.sources as unknown[]) : []).map(
      String,
    ),
  }
}

/** Grava a configuração do portal já normalizada e devolve o que ficou salvo. */
export class SaveInsightsConfig {
  constructor(
    private readonly deps: { settings: InsightsSettingsRepository },
  ) {}

  async execute(
    appId: string,
    patch: Record<string, unknown>,
  ): Promise<InsightsConfig> {
    const current = await new GetInsightsConfig(this.deps).execute(appId)
    const next = normalizeInsightsConfig(current, patch)
    await this.deps.settings.saveConfig(appId, next)
    return next
  }
}
