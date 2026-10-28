import {
  listExpirationRuns,
  type ExpirationRun,
} from '@/lib/subscription-expiration-runs'

/**
 * Catálogo dos jobs que o portal admin acompanha. Cada job novo (verificação
 * completa de assinaturas, sincronização com o Stripe) entra aqui com o próprio
 * `fetchRecentRuns` e uma página de detalhe em `admin-job-pages.tsx`.
 */
export type AdminJobId = 'expiracao-assinaturas'

/** O mínimo de uma rodada que o catálogo e a home precisam, igual para todo job. */
export type JobRunSummary = {
  id: string
  status: 'running' | 'success' | 'failed'
  abandoned: boolean
  paused: boolean
  /** Falhas por item (assinatura, linha…) numa rodada que chegou ao fim. */
  itemFailures: number
  startedAt: string
}

export type AdminJobDefinition = {
  id: AdminJobId
  /** Chaves em `admin/jobs`. */
  nameKey: string
  descriptionKey: string
  scheduleKey: string
  /** Periodicidade; a rodada mais velha que o dobro disto deixa o job "atrasado". */
  intervalMs: number
  /** Rodadas mais recentes primeiro. */
  fetchRecentRuns: (limit: number) => Promise<JobRunSummary[]>
}

const HOUR_MS = 60 * 60 * 1000

const toRunSummary = (run: ExpirationRun): JobRunSummary => ({
  id: run.id,
  status: run.status,
  abandoned: run.abandoned,
  paused: run.paused,
  itemFailures: run.failed,
  startedAt: run.startedAt,
})

export const ADMIN_JOBS: AdminJobDefinition[] = [
  {
    id: 'expiracao-assinaturas',
    nameKey: 'jobs.expiracao-assinaturas.name',
    descriptionKey: 'jobs.expiracao-assinaturas.description',
    scheduleKey: 'jobs.expiracao-assinaturas.schedule',
    intervalMs: HOUR_MS,
    fetchRecentRuns: async limit => {
      const { runs } = await listExpirationRuns({ page: 1, limit })
      return runs.map(toRunSummary)
    },
  },
]

export function findAdminJob(id: string): AdminJobDefinition | null {
  return ADMIN_JOBS.find(job => job.id === id) ?? null
}

export type JobHealth =
  | 'no-runs'
  | 'running'
  | 'failing'
  | 'late'
  | 'attention'
  | 'healthy'

/**
 * Saúde do job pela rodada mais recente, na precedência da spec
 * `portal-admin/catalogo-jobs`: sem rodadas → em andamento → falha → atrasado →
 * atenção → saudável.
 */
export function deriveJobHealth(
  latest: JobRunSummary | null,
  intervalMs: number,
  now: Date,
): JobHealth {
  if (!latest) return 'no-runs'
  if (latest.status === 'running' && !latest.abandoned) return 'running'
  if (latest.status === 'failed' || latest.abandoned) return 'failing'
  if (now.getTime() - new Date(latest.startedAt).getTime() > 2 * intervalMs) {
    return 'late'
  }
  if (latest.itemFailures > 0 || latest.paused) return 'attention'
  return 'healthy'
}

/** Saúdes que entram em "Precisa de atenção" na home. */
export function jobHealthNeedsAttention(health: JobHealth): boolean {
  return health === 'failing' || health === 'late' || health === 'attention'
}
