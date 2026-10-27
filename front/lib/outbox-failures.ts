import axios from 'axios'
import { axiosPortal } from '@/infra/client/axios-portal'

export type OutboxFailureStatus = 'FAILED' | 'UNKNOWN'
export type OutboxStatus = 'PENDING' | 'SENDING' | 'SENT' | OutboxFailureStatus

export const OUTBOX_ORIGINS = [
  'OPERATOR',
  'WIDGET',
  'WIDGET_ATTACHMENT',
  'ROBOT_MESSAGE',
  'ROBOT_BUTTONS',
  'ROBOT_TEMPLATE',
  'SMS_CAMPAIGN',
  'BOT',
] as const
export type OutboxOrigin = (typeof OUTBOX_ORIGINS)[number]

export type OutboxFailure = {
  id: string
  createdAt: string
  updatedAt: string
  domainId: string
  domainName: string | null
  appCode: string
  subscriptionItemId: string
  origin: OutboxOrigin
  kind: 'TEXT' | 'TEMPLATE' | 'INTERACTIVE_BUTTON' | 'MEDIA'
  status: OutboxStatus
  /** Trecho na lista; integral no detalhe. */
  text: string
  fileName: string | null
  destination: string
  lastError: string | null
  attempts: number
  reprocessCount: number
  lastReprocessedAt: string | null
}

export type OutboxFailureDetail = OutboxFailure & {
  templateName: string | null
  mediaType: string | null
  caption: string | null
  bitrixChatId: string | null
  bitrixMessageId: string | null
  operatorBitrixUserId: string | null
  entity: string
  entityId: string
  providerMessageId: string | null
  sentAt: string | null
  lastReprocessedByEmail: string | null
}

export type ListOutboxFailuresParams = {
  page: number
  limit: number
  status?: OutboxFailureStatus
  domain?: string
  origin?: OutboxOrigin
  /** ISO. Sem datas, a API usa os últimos 7 dias. */
  from?: string
  to?: string
}

export type ListOutboxFailuresResponse = {
  items: OutboxFailure[]
  total: number
  page: number
  limit: number
}

export type ReprocessStatus =
  | 'requeued'
  | 'conflict'
  | 'needs-confirmation'
  | 'not-found'
  | 'schedule-failed'

export type ReprocessResult = { id: string; status: ReprocessStatus }

const BASE = '/portal/thinkzap/outbox-failures'

export function listOutboxFailures(
  params: ListOutboxFailuresParams,
): Promise<ListOutboxFailuresResponse> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  })
  if (params.status) query.set('status', params.status)
  if (params.domain) query.set('domain', params.domain)
  if (params.origin) query.set('origin', params.origin)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)

  return axiosPortal().get<ListOutboxFailuresResponse>(
    `${BASE}?${query.toString()}`,
  )
}

export function getOutboxFailure(id: string): Promise<OutboxFailureDetail> {
  return axiosPortal().get<OutboxFailureDetail>(
    `${BASE}/${encodeURIComponent(id)}`,
  )
}

/**
 * Reprocessa uma intenção. As recusas esperadas da API (409, 422, 404, 503) viram
 * resultado com o `code`, não exceção: cada uma tem o seu aviso na tela.
 */
export async function reprocessOutboxFailure(
  id: string,
  acknowledgeDuplicateRisk = false,
): Promise<ReprocessStatus> {
  try {
    await axiosPortal().post(`${BASE}/${encodeURIComponent(id)}/reprocess`, {
      acknowledgeDuplicateRisk,
    })
    return 'requeued'
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const code = (
        error.response?.data as { result?: { code?: string } } | undefined
      )?.result?.code
      if (isReprocessStatus(code)) return code
    }
    throw error
  }
}

export async function reprocessOutboxFailures(
  ids: string[],
  acknowledgeDuplicateRisk = false,
): Promise<ReprocessResult[]> {
  const { results } = await axiosPortal().post<{ results: ReprocessResult[] }>(
    `${BASE}/reprocess`,
    { ids, acknowledgeDuplicateRisk },
  )
  return results
}

function isReprocessStatus(value: unknown): value is ReprocessStatus {
  return (
    value === 'requeued' ||
    value === 'conflict' ||
    value === 'needs-confirmation' ||
    value === 'not-found' ||
    value === 'schedule-failed'
  )
}

/** Quantos de cada desfecho, para o resumo do lote. */
export function summarizeReprocess(
  results: ReprocessResult[],
): Record<ReprocessStatus, number> {
  const summary: Record<ReprocessStatus, number> = {
    requeued: 0,
    conflict: 0,
    'needs-confirmation': 0,
    'not-found': 0,
    'schedule-failed': 0,
  }
  for (const result of results) summary[result.status]++
  return summary
}
