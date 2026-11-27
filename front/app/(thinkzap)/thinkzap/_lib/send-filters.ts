import { isSendStatus, type SendStatus } from './send-status'

export const SEND_PERIOD_PRESETS = [7, 30, 90] as const
export type SendPeriodPreset = (typeof SEND_PERIOD_PRESETS)[number]

export const SEND_DEFAULT_PERIOD_DAYS: SendPeriodPreset = 7
/** Mesmo teto da API (`SEND_LIST_MAX_PAGE`); acima disso ela responde 400. */
export const SEND_MAX_PAGE = 10000
const MAX_TEXT_LENGTH = 191

export type SendPeriod =
  | { kind: 'preset'; days: SendPeriodPreset }
  /** `from`/`to` em `YYYY-MM-DD`, dias do calendário do usuário (fuso local). */
  | { kind: 'custom'; from: string; to: string }

export type SendFilters = {
  period: SendPeriod
  status: SendStatus | null
  lineId: string | null
  destination: string | null
  /** Só administrador filtra por remetente; para os demais a API ignora. */
  senderId: string | null
  page: number
}

export const DEFAULT_SEND_FILTERS: SendFilters = {
  period: { kind: 'preset', days: SEND_DEFAULT_PERIOD_DAYS },
  status: null,
  lineId: null,
  destination: null,
  senderId: null,
  page: 1,
}

/** Aceita `URLSearchParams` ou o `ReadonlyURLSearchParams` do Next. */
type SearchParamsLike = { get(name: string): string | null }

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Data local a partir de `YYYY-MM-DD`; `null` para formato ou dia inexistente. */
function parseLocalDay(value: string | null): Date | null {
  const m = value ? DAY_RE.exec(value) : null
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(y, mo - 1, d)
  // 2026-02-31 viraria março: o round trip recusa.
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  ) {
    return null
  }
  return date
}

function text(value: string | null): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed || trimmed.length > MAX_TEXT_LENGTH) return null
  return trimmed
}

function readPeriod(params: SearchParamsLike): SendPeriod {
  const raw = params.get('period')
  if (raw === 'custom') {
    const from = params.get('from')
    const to = params.get('to')
    const fromDate = parseLocalDay(from)
    const toDate = parseLocalDay(to)
    if (from && to && fromDate && toDate && fromDate <= toDate) {
      return { kind: 'custom', from, to }
    }
    return DEFAULT_SEND_FILTERS.period
  }
  const days = Number(raw)
  const preset = SEND_PERIOD_PRESETS.find(p => p === days)
  return preset ? { kind: 'preset', days: preset } : DEFAULT_SEND_FILTERS.period
}

/**
 * Lê os filtros da URL. A URL é entrada do usuário (link colado, voltar do
 * navegador): qualquer valor inválido volta ao padrão em vez de quebrar a tela
 * ou chegar à API para virar 400.
 */
export function readSendFilters(params: SearchParamsLike): SendFilters {
  const status = params.get('status')
  const pageRaw = params.get('page')
  const page = pageRaw && /^\d+$/.test(pageRaw) ? Number(pageRaw) : 1
  const pageOk =
    Number.isSafeInteger(page) && page >= 1 && page <= SEND_MAX_PAGE
  return {
    period: readPeriod(params),
    status: isSendStatus(status) ? status : null,
    lineId: text(params.get('line')),
    destination: text(params.get('destination')),
    senderId: text(params.get('senderId')),
    page: pageOk ? page : 1,
  }
}

/**
 * Filtros -> query string (sem `?`). Só escreve o que difere do padrão: a URL
 * limpa é a do estado inicial, e o round trip com `readSendFilters` é exato.
 */
export function writeSendFilters(filters: SendFilters): string {
  const params = new URLSearchParams()
  const { period } = filters
  if (period.kind === 'custom') {
    params.set('period', 'custom')
    params.set('from', period.from)
    params.set('to', period.to)
  } else if (period.days !== SEND_DEFAULT_PERIOD_DAYS) {
    params.set('period', String(period.days))
  }
  if (filters.status) params.set('status', filters.status)
  if (filters.lineId) params.set('line', filters.lineId)
  if (filters.destination) params.set('destination', filters.destination)
  if (filters.senderId) params.set('senderId', filters.senderId)
  if (filters.page > 1) params.set('page', String(filters.page))
  return params.toString()
}

/** Query aceita por `GET /thinkzap/messages/sends` (instantes ISO com offset). */
export type SendListApiQuery = {
  from: string
  to: string
  status?: SendStatus
  line?: string
  destination?: string
  senderId?: string
  page?: number
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

/**
 * Filtros -> parâmetros da API. `from` é o início do dia LOCAL e `to` o fim do
 * dia LOCAL, enviados como instante completo (`toISOString`, sufixo `Z`). A API
 * aceita `YYYY-MM-DD` mas o lê como dia UTC; para quem está no Brasil (UTC-3)
 * isso cortaria três horas do fim do dia. Instantes locais não têm esse erro.
 *
 * Preset de N dias = hoje e os N-1 anteriores (7 dias inclui hoje). Filtros
 * vazios ficam de fora; `page` 1 também (é o padrão da API).
 */
export function toApiQuery(filters: SendFilters, now: Date): SendListApiQuery {
  const { period } = filters
  let from: Date
  let to: Date
  if (period.kind === 'custom') {
    // Já validado em `readSendFilters`; o fallback cobre filtro montado à mão.
    from = startOfLocalDay(parseLocalDay(period.from) ?? now)
    to = endOfLocalDay(parseLocalDay(period.to) ?? now)
  } else {
    const start = startOfLocalDay(now)
    start.setDate(start.getDate() - (period.days - 1))
    from = start
    to = endOfLocalDay(now)
  }
  const query: SendListApiQuery = {
    from: from.toISOString(),
    to: to.toISOString(),
  }
  if (filters.status) query.status = filters.status
  if (filters.lineId) query.line = filters.lineId
  if (filters.destination) query.destination = filters.destination
  if (filters.senderId) query.senderId = filters.senderId
  if (filters.page > 1) query.page = filters.page
  return query
}
