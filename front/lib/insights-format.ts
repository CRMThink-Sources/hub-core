/**
 * Formatação e derivações puras da tela do Insights. Ficam fora dos componentes
 * para terem teste em ambiente node (o front não tem teste de componente).
 *
 * Referência: os formatadores `dur`, `pc`, `hhmm` e `durShort` do `index.html`
 * original. `formatDuration` é mais preciso que o `dur` original ("2 min" lá
 * podia ser 1 min 31 s): na tabela da equipe a diferença entre operadores
 * costuma estar nos segundos.
 */

const DASH = '—'

const isNumber = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v)

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * Duração em segundos, com as duas maiores unidades:
 * `45 s`, `2 min 05 s`, `1 h 02 min`, `1 d 03 h`. A unidade menor some quando é
 * zero (`2 min`, `1 h`). O total é arredondado antes de quebrar em partes, para
 * 59,6 s virar `1 min` e não `60 s`. Negativo (relógio adiantado no Bitrix) vira
 * zero. As unidades são abreviações iguais em pt, en e es — por isso não passam
 * pelo i18n.
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (!isNumber(seconds)) return DASH
  const total = Math.max(0, Math.round(seconds))
  if (total < 60) return `${total} s`
  if (total < 3600) {
    const m = Math.floor(total / 60)
    const s = total % 60
    return s ? `${m} min ${pad2(s)} s` : `${m} min`
  }
  if (total < 86400) {
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    return m ? `${h} h ${pad2(m)} min` : `${h} h`
  }
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  return h ? `${d} d ${pad2(h)} h` : `${d} d`
}

/**
 * Rótulo curto para os pontos dos gráficos (`42s`, `10m`, `1,5h`, `2d`), como o
 * `durShort` original: abaixo de 10 h e hora quebrada mostra uma casa decimal.
 */
export function formatDurationShort(
  seconds: number | null | undefined,
  locale = 'pt',
): string {
  if (!isNumber(seconds)) return DASH
  const s = Math.max(0, seconds)
  if (s < 60) return `${Math.round(s)}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) {
    const h =
      s < 36000 && s % 3600
        ? new Intl.NumberFormat(locale, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(s / 3600)
        : String(Math.round(s / 3600))
    return `${h}h`
  }
  return `${Math.round(s / 86400)}d`
}

/**
 * Percentual já em 0–100, com até uma casa decimal e o separador do idioma
 * (`91,7%` em pt, `91.7%` em en). O `%` vai colado, como no original.
 */
export function formatPercent(
  value: number | null | undefined,
  locale = 'pt',
): string {
  if (!isNumber(value)) return DASH
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    value,
  )
  return `${n}%`
}

/** `part / total` em 0–100; divisor zero devolve null (vira `—`, não `NaN%`). */
export function ratioPercent(part: number, total: number): number | null {
  if (!isNumber(part) || !isNumber(total) || total === 0) return null
  return (part / total) * 100
}

/**
 * Variação inteira contra o período anterior. Sem base (anterior zero ou
 * ausente) devolve null: "+∞%" não ajuda ninguém a decidir nada.
 */
export function deltaPercent(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (!isNumber(current) || !isNumber(previous) || previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export type Trend = 'better' | 'worse' | 'same' | 'none'

/** `betterUp`: o indicador melhora quando sobe (ex.: % respondido no prazo). */
export function trendOf(
  current: number | null | undefined,
  previous: number | null | undefined,
  betterUp: boolean,
): Trend {
  if (!isNumber(current) || !isNumber(previous)) return 'none'
  if (current === previous) return 'same'
  return (betterUp ? current > previous : current < previous)
    ? 'better'
    : 'worse'
}

export type HealthLevel = 'good' | 'warn' | 'bad' | 'none'

/** Limites dos cartões de saúde do original (Rapidez). */
export function slaLevel(slaPct: number | null): HealthLevel {
  if (!isNumber(slaPct)) return 'none'
  return slaPct >= 80 ? 'good' : slaPct >= 50 ? 'warn' : 'bad'
}

/** Limites do cartão "Ninguém sem resposta". */
export function noAnswerLevel(noAnswerPct: number | null): HealthLevel {
  if (!isNumber(noAnswerPct)) return 'none'
  return noAnswerPct <= 5 ? 'good' : noAnswerPct <= 15 ? 'warn' : 'bad'
}

/** Limites do cartão "Resolvido de primeira" (recontato em até 48 h). */
export function recontactLevel(
  recontact48: number,
  total: number,
): HealthLevel {
  const pct = ratioPercent(recontact48, total)
  if (pct === null) return 'none'
  return pct <= 10 ? 'good' : pct <= 25 ? 'warn' : 'bad'
}

/** "8 em cada 10": o original arredonda o percentual para dezenas. */
export const outOfTen = (pct: number) => Math.round(pct / 10)

/** Minutos desde a meia-noite em `HH:MM`. */
export function formatClock(minutes: number | null | undefined): string {
  if (!isNumber(minutes)) return DASH
  const m = Math.floor(minutes)
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
}

/** Valores de negócio do Bitrix chegam em reais; sem centavos, como no original. */
export function formatMoney(
  value: number | null | undefined,
  locale = 'pt-BR',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(isNumber(value) ? value : 0)
}

export const CRM_TYPES = ['contact', 'lead', 'deal', 'company'] as const
export type CrmType = (typeof CRM_TYPES)[number]

const HOST_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d{1,5})?$/i

/**
 * Link para a ficha do CRM. `portal` vem do Bitrix e vai para um `href`: só
 * passa se for um host puro, senão um valor como `javascript:` ou `x.com/...`
 * viraria link para fora do portal. Tipo e id também são conferidos.
 */
export function crmUrl(
  portal: string | null | undefined,
  type: string | null | undefined,
  id: number | null | undefined,
): string | null {
  if (!portal || !HOST_RE.test(portal)) return null
  if (!type || !(CRM_TYPES as readonly string[]).includes(type)) return null
  if (!isNumber(id) || id <= 0 || !Number.isInteger(id)) return null
  return `https://${portal}/crm/${type}/details/${id}/`
}

/** Teto do eixo de quantidade: 2, 5 ou 10 vezes uma potência de 10. */
export function roundAxisMax(v: number): number {
  if (v <= 5) return 5
  const p = 10 ** Math.floor(Math.log10(v))
  const m = v / p
  return (m <= 2 ? 2 : m <= 5 ? 5 : 10) * p
}

const WAIT_AXIS_STEPS = [1200, 2400, 3600, 7200, 14400, 28800, 86400, 172800]

/**
 * Teto do eixo de espera. Pelo menos 1,5x a referência (a linha da meta não
 * cola no topo) e no máximo 6x: uma conversa esquecida de 3 dias achataria
 * todo o resto do gráfico. Arredonda para um tempo redondo.
 */
export function waitAxisMax(waits: (number | null)[], refSec: number): number {
  const valid = waits.filter(isNumber)
  const need = Math.max(
    refSec * 1.5,
    Math.min(Math.max(0, ...valid), refSec * 6),
  )
  return WAIT_AXIS_STEPS.find(c => c >= need) ?? need
}

/** Duas horas de maior movimento e o intervalo de horas com alguma conversa. */
export function peakHours(
  byHour: number[],
): { top: number[]; first: number; last: number } | null {
  const first = byHour.findIndex(v => v > 0)
  if (first < 0) return null
  let last = first
  byHour.forEach((v, h) => {
    if (v > 0) last = h
  })
  const top = byHour
    .map((v, h) => [h, v] as const)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([h]) => h)
  return { top, first, last }
}

const toIsoDay = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/**
 * Últimos 30 dias contando hoje. Usa o dia do relógio local, não
 * `toISOString()`: às 22h em Brasília o UTC já é o dia seguinte.
 */
export function defaultPeriod(now: Date): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
  return { from: toIsoDay(from), to: toIsoDay(now) }
}

type CsvCell = string | number | null | undefined

/**
 * Planilha da equipe. `;` e BOM porque é o que o Excel em pt-BR abre direto.
 * Texto que começa com `= + - @` ganha um `'` na frente: nome de cliente ou
 * operador vem do Bitrix e o Excel executaria como fórmula (CSV injection).
 * Número negativo não é texto e passa como está.
 */
export function buildTeamCsv(headers: string[], rows: CsvCell[][]): string {
  const cell = (c: CsvCell) => {
    let s = c == null ? '' : String(c)
    if (typeof c === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`
    return `"${s.replace(/"/g, '""')}"`
  }
  return '﻿' + [headers, ...rows].map(r => r.map(cell).join(';')).join('\n')
}
