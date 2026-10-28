import axios from 'axios'
import { axiosPortal } from '@/infra/client/axios-portal'
import type { SubscriptionStatus } from '@/lib/subscription-expiration-runs'

export type StripeSyncTrigger = 'scheduled' | 'manual'
export type StripeSyncRunStatus = 'running' | 'success' | 'failed'

export type StripeSyncRun = {
  id: string
  trigger: StripeSyncTrigger
  triggeredBy: { id: string; name: string } | null
  status: StripeSyncRunStatus
  startedAt: string
  finishedAt: string | null
  /** Ids do gateway lidos no Stripe. */
  checked: number
  /** Puladas: outro ambiente Stripe ou sem id do gateway. */
  skipped: number
  updated: number
  cancelled: number
  linesUnsubscribed: number
  notFound: number
  failed: number
  paused: boolean
  error: string | null
  /** `running` há mais de 1h: o processo morreu sem gravar o fim. */
  abandoned: boolean
  durationMs: number | null
}

export type StripeSyncChangeKind =
  | 'updated'
  | 'cancelled'
  | 'line-unsubscribed'
  | 'not-found'
  | 'unknown-status'
  | 'failed'

export type StripeSyncChange = {
  kind: StripeSyncChangeKind
  subscriptionId: string
  gatewayId: string
  itemId?: string
  provider?: 'ZAPI' | 'HUBMESSAGE'
  fromStatus: SubscriptionStatus | null
  /** Em `unknown-status`, o status cru do Stripe. */
  toStatus: string | null
  /** Instantes ISO. O anterior é o dia da SPA; o novo, o instante do Stripe. */
  fromPeriodEnd: string | null
  toPeriodEnd: string | null
  succeeded: boolean
  error?: string
  crmUrl: string | null
  itemCrmUrl: string | null
}

export type StripeSyncRunDetail = StripeSyncRun & {
  changes: StripeSyncChange[]
}

export type ListStripeSyncRunsResponse = {
  runs: StripeSyncRun[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export type ListStripeSyncRunsParams = {
  page: number
  limit: number
  trigger?: StripeSyncTrigger
  onlyWithChanges?: boolean
}

const BASE = '/portal/stripe-sync/runs'

export function listStripeSyncRuns(
  params: ListStripeSyncRunsParams,
): Promise<ListStripeSyncRunsResponse> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  })
  if (params.trigger) query.set('trigger', params.trigger)
  if (params.onlyWithChanges) query.set('onlyWithChanges', 'true')

  return axiosPortal().get<ListStripeSyncRunsResponse>(
    `${BASE}?${query.toString()}`,
  )
}

export function getStripeSyncRun(id: string): Promise<StripeSyncRunDetail> {
  return axiosPortal().get<StripeSyncRunDetail>(
    `${BASE}/${encodeURIComponent(id)}`,
  )
}

export type StartStripeSyncRunResult =
  | { status: 'started'; runId: string }
  | { status: 'busy' }
  | { status: 'disabled' }

/** "Rodar agora". Os dois `409` da API viram resultado, como na verificação. */
export async function startStripeSyncRun(): Promise<StartStripeSyncRunResult> {
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
