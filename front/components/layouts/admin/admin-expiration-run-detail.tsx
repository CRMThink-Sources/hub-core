'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatPortalDate, formatSpaDate } from '@/lib/format-date'
import { cn } from '@/lib/utils'
import {
  getExpirationRun,
  type ExpirationRun,
  type ExpirationRunDetail,
} from '@/lib/subscription-expiration-runs'
import {
  ExpirationRunStatusBadge,
  formatDuration,
  triggeredByLabel,
} from './admin-expiration-runs-table'

type Props = {
  /** A rodada aberta; `null` fecha o painel. */
  run: ExpirationRun | null
  onClose: () => void
}

export function AdminExpirationRunDetail({ run, onClose }: Props) {
  const { t, i18n } = useTranslation('admin/jobs')
  const { t: tCommon } = useTranslation('common')
  const locale = i18n.language

  const [detail, setDetail] = useState<ExpirationRunDetail | null>(null)
  const [hasError, setHasError] = useState(false)

  const runId = run?.id ?? null

  useEffect(() => {
    if (!runId) return
    let cancelled = false

    setDetail(null)
    setHasError(false)

    getExpirationRun(runId)
      .then(result => {
        if (!cancelled) setDetail(result)
      })
      .catch(() => {
        if (!cancelled) setHasError(true)
      })

    return () => {
      cancelled = true
    }
  }, [runId])

  const shown = detail ?? run

  return (
    <Sheet
      open={run !== null}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-2xl">
        {shown && (
          <>
            <SheetHeader>
              <SheetTitle>
                {t('detailTitle', {
                  date: formatPortalDate(shown.startedAt, locale),
                })}
              </SheetTitle>
              <SheetDescription>
                {t(`trigger.${shown.trigger}`)} · {triggeredByLabel(shown, t)} ·{' '}
                {formatDuration(shown.durationMs, t)}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4 pb-6">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <ExpirationRunStatusBadge run={shown} />
                <span className="text-muted-foreground">
                  {t('table.checked')}: {shown.checked} ·{' '}
                  {t('table.trialExpired')}: {shown.trialExpired} ·{' '}
                  {t('table.pastDue')}: {shown.pastDue} · {t('table.failed')}:{' '}
                  {shown.failed}
                </span>
              </div>

              {shown.error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  {t('detailError', { error: shown.error })}
                </p>
              )}

              {hasError ? (
                <p className="text-sm text-muted-foreground">
                  {t('detailLoadError')}
                </p>
              ) : !detail ? (
                <p className="text-sm text-muted-foreground">
                  {tCommon('carregando')}
                </p>
              ) : detail.changes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('detailEmpty')}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-medium">
                          {t('change.subscription')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('change.transition')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('change.periodEnd')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('change.result')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.changes.map(change => (
                        <tr
                          key={change.subscriptionId}
                          className="border-b border-border align-top last:border-b-0"
                        >
                          <td className="px-3 py-2 font-medium whitespace-nowrap">
                            {change.crmUrl ? (
                              <a
                                href={change.crmUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                title={t('change.openCrm')}
                              >
                                #{change.subscriptionId}
                                <ExternalLink className="size-3" />
                              </a>
                            ) : (
                              `#${change.subscriptionId}`
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {t(`subscriptionStatus.${change.from}`)} →{' '}
                            {t(`subscriptionStatus.${change.to}`)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                            {formatSpaDate(change.periodEnd, locale)}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                'font-medium',
                                change.succeeded
                                  ? 'text-green-700 dark:text-green-300'
                                  : 'text-red-600 dark:text-red-400',
                              )}
                            >
                              {change.succeeded
                                ? t('change.succeeded')
                                : t('change.failed')}
                            </span>
                            {change.error && (
                              <p className="mt-1 text-xs break-words text-muted-foreground">
                                {change.error}
                              </p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
