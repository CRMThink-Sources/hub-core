'use client'

import { useTranslation } from 'react-i18next'
import { formatPortalDate } from '@/lib/format-date'
import { cn } from '@/lib/utils'
import type { StripeSyncRun } from '@/lib/stripe-sync-runs'
import {
  CountList,
  ExpirationRunStatusBadge,
  formatDuration,
  triggeredByLabel,
} from './admin-expiration-runs-table'

type Props = {
  runs: StripeSyncRun[]
  onOpen: (run: StripeSyncRun) => void
}

/** Rodadas da sincronização Stripe: mesma tabela da verificação, com os contadores dela. */
export function AdminStripeSyncRunsTable({ runs, onOpen }: Props) {
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
              {t('stripeSync.table.notFound')}
            </th>
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
              </td>
              <td className="px-4 py-3">
                <CountList
                  items={[
                    ['stripeSync.count.updated', run.updated],
                    ['count.cancelled', run.cancelled],
                    ['stripeSync.count.checked', run.checked, true],
                  ]}
                />
              </td>
              <td className="px-4 py-3">
                <CountList
                  items={[['count.linesUnsubscribed', run.linesUnsubscribed]]}
                />
              </td>
              <td
                className={cn(
                  'px-4 py-3 text-right tabular-nums',
                  run.notFound > 0
                    ? 'font-semibold text-status-warning-ink'
                    : 'text-muted-foreground',
                )}
              >
                {run.notFound}
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
