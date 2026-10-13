import axios from 'axios'
import { axiosPortal } from '@/infra/client/axios-portal'

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'trialing'
  | 'trial_expired'

export type ExpirationRunTrigger = 'scheduled' | 'manual'
export type ExpirationRunStatus = 'running' | 'success' | 'failed'

export type ExpirationRun = {
  id: string
  trigger: ExpirationRunTrigger
  triggeredBy: { id: string; name: string } | null
  status: ExpirationRunStatus
  startedAt: string
  finishedAt: string | null
  checked: number
  trialExpired: number
  pastDue: number
  failed: number
  paused: boolean
  error: string | null
  /** `running` há mais de 1h: o processo morreu sem gravar o fim. */
  abandoned: boolean
  durationMs: number | null
}

export type ExpirationChange = {
  subscriptionId: string
  from: SubscriptionStatus
  to: Extract<SubscriptionStatus, 'trial_expired' | 'past_due'>
  /** Dia de calendário ancorado em UTC — formatar com `formatSpaDate`. */
  periodEnd: string
  succeeded: boolean
  error?: string
  crmUrl: string | null
}

export type ExpirationRunDetail = ExpirationRun & {
  changes: ExpirationChange[]
}

export type ListExpirationRunsResponse = {
  runs: ExpirationRun[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export type ListExpirationRunsParams = {
  page: number
  limit: number
  trigger?: ExpirationRunTrigger
  onlyWithChanges?: boolean
}

const BASE = '/portal/subscription-expiration/runs'

export function listExpirationRuns(
  params: ListExpirationRunsParams,
): Promise<ListExpirationRunsResponse> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  })
  if (params.trigger) query.set('trigger', params.trigger)
  if (params.onlyWithChanges) query.set('onlyWithChanges', 'true')

  return axiosPortal().get<ListExpirationRunsResponse>(
    `${BASE}?${query.toString()}`,
  )
}

export function getExpirationRun(id: string): Promise<ExpirationRunDetail> {
  return axiosPortal().get<ExpirationRunDetail>(
    `${BASE}/${encodeURIComponent(id)}`,
  )
}

export type StartExpirationRunResult =
  | { status: 'started'; runId: string }
  | { status: 'busy' }
  | { status: 'disabled' }

/**
 * "Rodar agora". Os dois `409` da API viram resultado, não exceção: são respostas
 * esperadas, cada uma com o seu aviso na tela.
 */
export async function startExpirationRun(): Promise<StartExpirationRunResult> {
  try {
    const { runId } = await axiosPortal().post<{ runId: string }>(BASE)
    return { status: 'started', runId }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      const code = (
        error.response.data as { result?: { code?: string } } | undefined
      )?.result?.code
      if (code === 'busy' || code === 'disabled') return { status: code }
    }
    throw error
  }
}
