'use client'

import { useTranslation } from 'react-i18next'
import { formatPortalDate } from '@/lib/format-date'
import { cn } from '@/lib/utils'
import type { ExpirationRun } from '@/lib/subscription-expiration-runs'
import { AdminStatusBadge, type AdminStatusTone } from './ui/admin-status-badge'

type Props = {
  runs: ExpirationRun[]
  onOpen: (run: ExpirationRun) => void
}

const RUN_TONE: Record<ExpirationRun['status'] | 'abandoned', AdminStatusTone> =
  {
    success: 'success',
    running: 'info',
    failed: 'danger',
    abandoned: 'warning',
  }

/** Os campos que os helpers de rodada usam — comuns à verificação e à sincronização Stripe. */
type RunLike = Pick<
  ExpirationRun,
  'status' | 'abandoned' | 'paused' | 'trigger' | 'triggeredBy'
>

export function ExpirationRunStatusBadge({ run }: { run: RunLike }) {
  const { t } = useTranslation('admin/jobs')

  const key = run.abandoned ? 'abandoned' : run.status

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <AdminStatusBadge tone={RUN_TONE[key]}>
        {t(`runStatus.${key}`)}
      </AdminStatusBadge>
      {run.paused && (
        <AdminStatusBadge tone="warning">{t('pausedBadge')}</AdminStatusBadge>
      )}
    </span>
  )
}

export function triggeredByLabel(
  run: Pick<RunLike, 'trigger' | 'triggeredBy'>,
  t: (key: string) => string,
): string {
  if (run.trigger === 'scheduled') return t('system')
  return run.triggeredBy?.name ?? '—'
}

export function formatDuration(
  durationMs: number | null,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (durationMs === null) return '—'
  return t('durationSeconds', { value: (durationMs / 1000).toFixed(1) })
}

export function AdminExpirationRunsTable({ runs, onOpen }: Props) {
  const { t, i18n } = useTranslation('admin/jobs')
  const locale = i18n.language

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">{t('table.startedAt')}</th>
            <th className="px-4 py-3 font-medium">{t('table.duration')}</th>
            <th className="px-4 py-3 font-medium">{t('table.trigger')}</th>
            <th className="px-4 py-3 font-medium">{t('table.triggeredBy')}</th>
            <th className="px-4 py-3 font-medium">{t('table.status')}</th>
            <th className="px-4 py-3 font-medium">
              {t('table.subscriptions')}
            </th>
            <th className="px-4 py-3 font-medium">{t('table.lines')}</th>
            <th className="px-4 py-3 text-right font-medium">
              {t('table.failed')}
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map(run => (
            <tr
              key={run.id}
              tabIndex={0}
              onClick={() => onOpen(run)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpen(run)
                }
              }}
              className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
            >
              <td className="px-4 py-3 font-medium whitespace-nowrap text-foreground">
                {formatPortalDate(run.startedAt, locale)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                {formatDuration(run.durationMs, t)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {t(`trigger.${run.trigger}`)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {triggeredByLabel(run, t)}
              </td>
              <td className="px-4 py-3">
                <ExpirationRunStatusBadge run={run} />
                <RunTags run={run} />
              </td>
              <td className="px-4 py-3">
                <CountList
                  items={[
                    ['count.trialExpired', run.trialExpired],
                    ['count.pastDue', run.pastDue],
                    ['count.cancelled', run.cancelled ?? 0],
                  ]}
                />
              </td>
              <td className="px-4 py-3">
                <CountList
                  items={[
                    ['count.linesUnsubscribed', run.linesUnsubscribed ?? 0],
                    ['count.linesSubscribed', run.linesSubscribed ?? 0],
                    ...(run.reconciliation
                      ? ([
                          ['count.linesChecked', run.linesChecked ?? 0, true],
                        ] as const)
                      : []),
                  ]}
                />
              </td>
              <td
                className={cn(
                  'px-4 py-3 text-right tabular-nums',
                  run.failed > 0 && 'font-semibold text-status-danger-ink',
                )}
              >
                {run.failed}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Contadores de uma célula, um por linha, só os diferentes de zero; tudo zero vira um
 * traço. `muted` para o que é contexto (linhas verificadas), não alteração.
 */
export function CountList({
  items,
}: {
  items: ReadonlyArray<
    readonly [string, number] | readonly [string, number, boolean]
  >
}) {
  const { t } = useTranslation('admin/jobs')
  const visible = items.filter(([, count]) => count > 0)

  if (visible.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <ul className="space-y-0.5 whitespace-nowrap tabular-nums">
      {visible.map(([key, count, muted]) => (
        <li
          key={key}
          className={muted ? 'text-muted-foreground' : 'text-foreground'}
        >
          {t(key, { count })}
        </li>
      ))}
    </ul>
  )
}

/** Marcas da rodada: incluiu a reconciliação; etapas de provider puladas pelo ambiente. */
export function RunTags({ run }: { run: ExpirationRun }) {
  const { t } = useTranslation('admin/jobs')
  if (!run.reconciliation && !run.providerStepsSkipped) return null

  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {run.reconciliation && (
        <AdminStatusBadge tone="info">
          {t('tags.reconciliation')}
        </AdminStatusBadge>
      )}
      {run.providerStepsSkipped && (
        <AdminStatusBadge tone="neutral">
          {t('tags.providerSkipped')}
        </AdminStatusBadge>
      )}
    </span>
  )
}
