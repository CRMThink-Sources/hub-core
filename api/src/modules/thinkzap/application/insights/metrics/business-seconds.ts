import type { InsightsConfig } from '@/modules/thinkzap/domain/insights-config'

// Brasília fixa em UTC-3: o Brasil não tem mais horário de verão, e um offset
// fixo evita depender de dados de fuso no servidor.
const OFFSET_MS = 3 * 3600e3
const DAY_MS = 864e5
// Trava de segurança contra intervalos absurdos (datas inválidas ou antigas).
const MAX_DAYS = 400

/** Segundos de [a, b] que caem dentro do horário comercial (Brasília). */
export function businessSeconds(
  a: string | Date,
  b: string | Date,
  cfg: Pick<InsightsConfig, 'bhDays' | 'bhStart' | 'bhEnd'>,
): number {
  let t = new Date(a).getTime()
  const end = new Date(b).getTime()
  if (!(end > t)) return 0
  let sum = 0
  for (let i = 0; i < MAX_DAYS && t < end; i++) {
    const loc = new Date(t - OFFSET_MS)
    const dayStart =
      Date.UTC(loc.getUTCFullYear(), loc.getUTCMonth(), loc.getUTCDate()) +
      OFFSET_MS
    if (cfg.bhDays.includes(loc.getUTCDay())) {
      const ws = dayStart + cfg.bhStart * 3600e3
      const we = dayStart + cfg.bhEnd * 3600e3
      sum += Math.max(0, Math.min(we, end) - Math.max(ws, t))
    }
    t = dayStart + DAY_MS
  }
  return Math.round(sum / 1000)
}
