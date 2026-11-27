import {
  DEFAULT_SEND_FILTERS,
  SEND_MAX_PAGE,
  writeSendFilters,
  type SendFilters,
} from '../../_lib/send-filters'
import type { SendDetail, SendListItem } from '../../_lib/thinkzap-sends-client'

/** Chaves da query string que pertencem aos filtros da aba (`writeSendFilters`). */
export const SEND_FILTER_PARAM_KEYS = [
  'period',
  'from',
  'to',
  'status',
  'line',
  'destination',
  'senderId',
  'page',
] as const

/**
 * Troca só os parâmetros dos filtros na query string atual. Os demais ficam:
 * dentro do iframe do Bitrix a URL pode trazer `DOMAIN`, `member_id` e afins,
 * que outras partes do app leem de `window.location` — apagar esses
 * parâmetros ao filtrar quebraria quem depende deles.
 */
export function mergeSendFiltersIntoSearch(
  currentSearch: string,
  filters: SendFilters,
): string {
  const params = new URLSearchParams(currentSearch)
  for (const key of SEND_FILTER_PARAM_KEYS) params.delete(key)
  const own = new URLSearchParams(writeSendFilters(filters))
  own.forEach((value, key) => params.set(key, value))
  return params.toString()
}

/**
 * Mudar qualquer filtro volta para a página 1: a página 4 de um filtro não
 * corresponde a nada no filtro novo, e o total pode nem ter 4 páginas.
 */
export function withFilterChange(
  filters: SendFilters,
  patch: Partial<Omit<SendFilters, 'page'>>,
): SendFilters {
  return { ...filters, ...patch, page: 1 }
}

/** Filtros limpos, mantendo nada do estado anterior. */
export function clearedSendFilters(): SendFilters {
  return { ...DEFAULT_SEND_FILTERS }
}

/** Algum filtro difere do padrão (a página não conta: não é filtro). */
export function hasActiveFilters(filters: SendFilters): boolean {
  return writeSendFilters({ ...filters, page: 1 }) !== ''
}

export type SendPagination = {
  totalPages: number
  hasPrevious: boolean
  hasNext: boolean
}

/**
 * Paginação a partir do que a API devolveu. `limit` zero ou inválido não
 * divide (conta como uma página só); o teto é o mesmo da API, para o botão
 * "próxima" não pedir uma página que ela recusaria com 400.
 */
export function sendPagination(
  total: number,
  limit: number,
  page: number,
): SendPagination {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0
  const totalPages =
    Number.isFinite(limit) && limit > 0
      ? Math.min(SEND_MAX_PAGE, Math.max(1, Math.ceil(safeTotal / limit)))
      : 1
  return {
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  }
}

export type SenderDisplay =
  | { kind: 'name'; name: string }
  /** Robô do Bizproc sem usuário identificado. */
  | { kind: 'automation' }
  /** Usuário conhecido cujo nome o Bitrix não devolveu (falha ou removido). */
  | { kind: 'unknown' }

/**
 * Como mostrar o remetente. Sem `id` o envio veio de um robô sem usuário: é
 * "Automação". Com `id` mas sem nome, a resolução no Bitrix falhou; a tela
 * mostra um indicador neutro em vez de inventar um nome ou mostrar o id cru.
 */
export function senderDisplay(sender: SendListItem['sender']): SenderDisplay {
  const name = sender.name?.trim()
  if (name) return { kind: 'name', name }
  if (sender.id === null) return { kind: 'automation' }
  return { kind: 'unknown' }
}

export type SendTimestampKey = keyof SendDetail['timestamps']

const TIMESTAMP_ORDER: SendTimestampKey[] = [
  'sentAt',
  'deliveredAt',
  'readAt',
  'rejectedAt',
]

/** Horários presentes no detalhe, na ordem em que acontecem. */
export function presentTimestamps(
  timestamps: SendDetail['timestamps'],
): { key: SendTimestampKey; at: string }[] {
  return TIMESTAMP_ORDER.flatMap(key => {
    const at = timestamps[key]
    return at ? [{ key, at }] : []
  })
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Dia do calendário LOCAL em `YYYY-MM-DD` (formato do `<input type="date">`). */
export function toLocalDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** O dia local `days - 1` dias antes de `now` (7 dias = hoje e os 6 anteriores). */
export function localDayDaysAgo(now: Date, days: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  d.setDate(d.getDate() - (days - 1))
  return toLocalDay(d)
}

/**
 * Intervalo personalizado válido: os dois dias preenchidos e o início não
 * depois do fim. `YYYY-MM-DD` compara certo como texto.
 */
export function isValidCustomRange(from: string, to: string): boolean {
  const day = /^\d{4}-\d{2}-\d{2}$/
  return day.test(from) && day.test(to) && from <= to
}
