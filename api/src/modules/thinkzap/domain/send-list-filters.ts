import { InvalidSendListFilterError } from '@/modules/thinkzap/domain/errors/invalid-send-list-filter.error'
import type { RecipientState } from '@/modules/thinkzap/domain/send-notice'

/**
 * Filtros da aba Envios, normalizados antes de chegar ao repositório.
 *
 * Regra pura: recebe o `now` de fora para o teste fixar o relógio, e é aqui que
 * o teto de 90 dias é garantido — o repositório reaplica o piso por segurança,
 * mas a lista nunca depende só dele.
 */

/** O mesmo prazo de guarda do histórico dos envios rastreados. */
export const SEND_HISTORY_MAX_DAYS = 90
export const SEND_LIST_DEFAULT_DAYS = 7
export const SEND_LIST_DEFAULT_LIMIT = 20
export const SEND_LIST_MAX_LIMIT = 100
/**
 * Teto da página: `(page - 1) * limit` vira OFFSET no SQL, e um `page` absurdo
 * (ou `1e308`) estouraria o inteiro do banco em vez de devolver lista vazia.
 */
export const SEND_LIST_MAX_PAGE = 10000

const DAY_MS = 24 * 60 * 60 * 1000

/** Os mesmos estados que `summarizeRecipients` produz. */
export const SEND_LIST_STATUSES = [
  'WAITING',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
  'PARTIAL',
  'UNKNOWN',
] as const satisfies readonly RecipientState[]

export type SendListStatus = (typeof SEND_LIST_STATUSES)[number]

export type SendListFiltersInput = {
  from?: Date | string | null
  to?: Date | string | null
  status?: string | null
  /** Id do item de assinatura (a linha). */
  line?: string | null
  destination?: string | null
  senderId?: string | null
  page?: number | null
  limit?: number | null
}

export type SendListPeriod = { from: Date; to: Date }

export type SendListFilters = SendListPeriod & {
  status: SendListStatus | null
  subscriptionItemId: string | null
  /** Só dígitos: casa por trecho com a coluna `destination`, que é normalizada. */
  destination: string | null
  /** Filtro de remetente do administrador; o repositório o ignora para os demais. */
  senderId: string | null
  page: number
  limit: number
}

/**
 * Dias de histórico que a lista pode mostrar: no máximo 90, e nunca mais do que
 * a retenção configurada (`THINKZAP_SEND_HISTORY_DAYS`) — com retenção de 30 dias
 * o job já apagou o resto, e a tela não deve prometer mais que isso. A retenção
 * entra por parâmetro para este código seguir puro (sem ler env).
 */
export function effectiveSendHistoryDays(retentionDays: number): number {
  return Math.min(SEND_HISTORY_MAX_DAYS, retentionDays)
}

/** O mais antigo que a lista pode mostrar a partir de `now`. */
export function sendHistoryFloor(
  now: Date,
  historyDays: number = SEND_HISTORY_MAX_DAYS,
): Date {
  return new Date(now.getTime() - historyDays * DAY_MS)
}

function toDate(
  value: Date | string | null | undefined,
  field: 'from' | 'to',
): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new InvalidSendListFilterError(field, String(value))
  }
  return date
}

function toText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function isSendListStatus(value: string): value is SendListStatus {
  return (SEND_LIST_STATUSES as readonly string[]).includes(value)
}

/** Parte inteira de um número finito; o piso e o teto de cada campo ficam em quem chama. */
function toFiniteInt(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null
  }
  return Math.floor(value)
}

/**
 * Período acima de 90 dias é **limitado**, não recusado: o front pede "tudo" sem
 * precisar conhecer o prazo, e a resposta nunca traz envio mais antigo que ele.
 */
export function normalizeSendListFilters(
  input: SendListFiltersInput,
  now: Date,
  historyDays: number = SEND_HISTORY_MAX_DAYS,
): SendListFilters {
  const requestedTo = toDate(input.to, 'to')
  const requestedFrom = toDate(input.from, 'from')

  // Futuro não tem envio; limitar a `now` mantém o padrão de 7 dias contado de hoje.
  let to = requestedTo && requestedTo < now ? requestedTo : now
  let from =
    requestedFrom ?? new Date(to.getTime() - SEND_LIST_DEFAULT_DAYS * DAY_MS)

  // Datas trocadas na tela: o usuário quis o intervalo entre as duas.
  if (from > to) [from, to] = [to, from]

  const floor = sendHistoryFloor(now, historyDays)
  if (from < floor) from = floor
  // Período inteiro antes do prazo: `to < from` deixa a janela vazia, que é a
  // resposta certa (nada ali pode ser mostrado).

  const rawStatus = toText(input.status)
  let status: SendListStatus | null = null
  if (rawStatus !== null) {
    const upper = rawStatus.toUpperCase()
    if (!isSendListStatus(upper)) {
      throw new InvalidSendListFilterError('status', rawStatus)
    }
    status = upper
  }

  const digits = (input.destination ?? '').replace(/\D/g, '')

  const page = Math.min(
    SEND_LIST_MAX_PAGE,
    Math.max(1, toFiniteInt(input.page) ?? 1),
  )
  const limit = Math.min(
    SEND_LIST_MAX_LIMIT,
    Math.max(1, toFiniteInt(input.limit) ?? SEND_LIST_DEFAULT_LIMIT),
  )

  return {
    from,
    to,
    status,
    subscriptionItemId: toText(input.line),
    destination: digits === '' ? null : digits,
    senderId: toText(input.senderId),
    page,
    limit,
  }
}
