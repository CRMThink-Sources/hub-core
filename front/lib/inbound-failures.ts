import axios from 'axios'
import { axiosPortal } from '@/infra/client/axios-portal'
import type { DeliveryAttempt } from '@/lib/outbox-failures'

export type InboundFailureStatus = 'FAILED' | 'REPROCESSED'

export const INBOUND_SOURCES = [
  'z-api',
  'hubmessage',
  'hubmessage-status',
  'bitrix',
  'bitrix-bot',
] as const
export type InboundSource = (typeof INBOUND_SOURCES)[number]

/** O que a tela mostra de uma falha de recebimento. Nunca o conteúdo da mensagem. */
export type InboundFailure = {
  id: string
  createdAt: string
  source: InboundSource
  type: string
  traceKey: string | null
  domainId: string | null
  domainName: string | null
  errorCode: string
  /** Trecho na lista; integral no detalhe. */
  errorMessage: string
  attempts: number
  status: InboundFailureStatus
  reprocessCount: number
  lastReprocessedAt: string | null
  /** Só `FAILED`, de origem cuja reentrega não repete efeito externo. */
  reprocessable: boolean
}

export type InboundFailureDetail = InboundFailure & {
  instanceId: string | null
  /** Ids seguros do evento; nunca o texto nem o telefone do contato. */
  payloadFields: Record<string, string>
  previousFailureId: string | null
  lastReprocessedByEmail: string | null
  /** Vazio quando as tentativas já foram expurgadas. */
  attemptLog: DeliveryAttempt[]
}

export type ListInboundFailuresParams = {
  page: number
  limit: number
  status?: InboundFailureStatus
  domain?: string
  /** O portal exato (página do cliente). */
  domainId?: string
  source?: InboundSource
  /** ISO. Sem datas, a API usa o prazo de guarda (`retentionDays`). */
  from?: string
  to?: string
}

export type ListInboundFailuresResponse = {
  items: InboundFailure[]
  total: number
  page: number
  limit: number
  retentionDays: number
}

export type InboundReprocessStatus =
  | 'requeued'
  | 'conflict'
  | 'not-reprocessable'
  | 'not-found'
  | 'schedule-failed'

const BASE = '/portal/thinkzap/inbound-failures'

export function listInboundFailures(
  params: ListInboundFailuresParams,
): Promise<ListInboundFailuresResponse> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  })
  if (params.status) query.set('status', params.status)
  if (params.domain) query.set('domain', params.domain)
  if (params.domainId) query.set('domainId', params.domainId)
  if (params.source) query.set('source', params.source)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)

  return axiosPortal().get<ListInboundFailuresResponse>(
    `${BASE}?${query.toString()}`,
  )
}

export function getInboundFailure(id: string): Promise<InboundFailureDetail> {
  return axiosPortal().get<InboundFailureDetail>(
    `${BASE}/${encodeURIComponent(id)}`,
  )
}

function isReprocessStatus(value: unknown): value is InboundReprocessStatus {
  return (
    value === 'requeued' ||
    value === 'conflict' ||
    value === 'not-reprocessable' ||
    value === 'not-found' ||
    value === 'schedule-failed'
  )
}

/**
 * Reprocessa uma falha de recebimento. As recusas esperadas da API (409, 422, 404,
 * 503) viram resultado com o `code`, não exceção: cada uma tem o seu aviso na tela.
 */
export async function reprocessInboundFailure(
  id: string,
): Promise<InboundReprocessStatus> {
  try {
    await axiosPortal().post(`${BASE}/${encodeURIComponent(id)}/reprocess`, {})
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
