'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatPortalDate } from '@/lib/format-date'
import {
  ADMIN_JOBS,
  deriveJobHealth,
  type AdminJobDefinition,
  type AdminJobId,
  type JobHealth,
  type JobRunSummary,
} from '@/lib/admin-jobs'
import { cn } from '@/lib/utils'
import { AdminStatusBadge, type AdminStatusTone } from './ui/admin-status-badge'

/** Rodadas mostradas na faixa: um dia inteiro de um job horário. */
export const JOB_RUN_STRIP_SIZE = 24

export type AdminJobHealthState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready'
      runs: JobRunSummary[]
      latest: JobRunSummary | null
      health: JobHealth
      checkedAt: Date
    }

/**
 * Carrega as rodadas recentes de cada job do catálogo, de forma independente: a
 * falha de um job não esconde os outros.
 */
export function useAdminJobsHealth(jobs: AdminJobDefinition[] = ADMIN_JOBS) {
  const [states, setStates] = useState<Record<string, AdminJobHealthState>>(
    () => Object.fromEntries(jobs.map(job => [job.id, { status: 'loading' }])),
  )

  const load = useCallback(async (job: AdminJobDefinition) => {
    setStates(prev => ({ ...prev, [job.id]: { status: 'loading' } }))
    try {
      const runs = await job.fetchRecentRuns(JOB_RUN_STRIP_SIZE)
      const latest = runs[0] ?? null
      const checkedAt = new Date()
      setStates(prev => ({
        ...prev,
        [job.id]: {
          status: 'ready',
          runs,
          latest,
          health: deriveJobHealth(latest, job.intervalMs, checkedAt),
          checkedAt,
        },
      }))
    } catch {
      setStates(prev => ({ ...prev, [job.id]: { status: 'error' } }))
    }
  }, [])

  useEffect(() => {
    for (const job of jobs) void load(job)
  }, [jobs, load])

  const reload = useCallback(
    (id: AdminJobId) => {
      const job = jobs.find(item => item.id === id)
      if (job) void load(job)
    },
    [jobs, load],
  )

  return { states, reload }
}

const HEALTH_TONE: Record<JobHealth, AdminStatusTone> = {
  'no-runs': 'neutral',
  running: 'info',
  failing: 'danger',
  late: 'warning',
  attention: 'warning',
  healthy: 'success',
}

export function AdminJobHealthBadge({
  health,
  variant = 'dot',
}: {
  health: JobHealth
  variant?: 'dot' | 'pill'
}) {
  const { t } = useTranslation('admin/jobs')
  return (
    <AdminStatusBadge
      tone={HEALTH_TONE[health]}
      variant={variant}
      pulse={health === 'running'}
    >
      {t(`health.${health}`)}
    </AdminStatusBadge>
  )
}

const RUN_TONE_CLASS: Record<AdminStatusTone, string> = {
  success: 'bg-status-success',
  warning: 'bg-status-warning',
  danger: 'bg-status-danger',
  info: 'bg-status-info',
  neutral: 'bg-status-neutral',
}

function runTone(run: JobRunSummary): AdminStatusTone {
  if (run.status === 'failed' || run.abandoned) return 'danger'
  if (run.status === 'running') return 'info'
  if (run.itemFailures > 0 || run.paused) return 'warning'
  return 'success'
}

/**
 * As últimas rodadas lado a lado, da mais antiga (esquerda) para a mais recente
 * (direita). Vagas sem rodada ficam como trilho vazio, para um job novo mostrar
 * honestamente que rodou pouco.
 */
export function AdminJobRunStrip({
  runs,
  size = JOB_RUN_STRIP_SIZE,
  className,
}: {
  runs: JobRunSummary[]
  size?: number
  className?: string
}) {
  const { t, i18n } = useTranslation('admin/jobs')
  const ordered = runs.slice(0, size).reverse()
  const empty = size - ordered.length
  const failures = ordered.filter(run => runTone(run) === 'danger').length
  const warnings = ordered.filter(run => runTone(run) === 'warning').length

  return (
    <div
      role="img"
      aria-label={t('strip.label', {
        count: ordered.length,
        failures,
        warnings,
      })}
      className={cn('flex h-6 items-end gap-[3px]', className)}
    >
      {Array.from({ length: empty }, (_, index) => (
        <span
          key={`empty-${index}`}
          aria-hidden
          className="h-full flex-1 rounded-[2px] bg-muted"
        />
      ))}
      {ordered.map(run => (
        <span
          key={run.id}
          aria-hidden
          title={`${formatPortalDate(run.startedAt, i18n.language)} · ${t(`strip.tone.${runTone(run)}`)}`}
          className={cn(
            'h-full flex-1 rounded-[2px]',
            RUN_TONE_CLASS[runTone(run)],
          )}
        />
      ))}
    </div>
  )
}
