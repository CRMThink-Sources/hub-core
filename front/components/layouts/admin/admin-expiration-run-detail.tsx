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
  type ExpirationChange,
  type ExpirationChangeKind,
  type ExpirationRun,
  type ExpirationRunDetail,
} from '@/lib/subscription-expiration-runs'
import {
  ExpirationRunStatusBadge,
  RunTags,
  formatDuration,
  triggeredByLabel,
} from './admin-expiration-runs-table'

type Props = {
  /** A rodada aberta; `null` fecha o painel. */
  run: ExpirationRun | null
  onClose: () => void
}

const KIND_ORDER: ExpirationChangeKind[] = [
  'status',
  'line-unsubscribed',
  'line-subscribed',
]

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

  const groups = detail
    ? KIND_ORDER.map(kind => ({
        kind,
        changes: detail.changes.filter(
          change => (change.kind ?? 'status') === kind,
        ),
      })).filter(group => group.changes.length > 0)
    : []

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

            <div className="space-y-5 px-4 pb-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <ExpirationRunStatusBadge run={shown} />
                  <RunTags run={shown} />
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                  {(
                    [
                      ['table.checked', shown.checked],
                      ['table.trialExpired', shown.trialExpired],
                      ['table.pastDue', shown.pastDue],
                      ['table.cancelled', shown.cancelled ?? 0],
                      ['table.linesUnsubscribed', shown.linesUnsubscribed ?? 0],
                      ['table.linesSubscribed', shown.linesSubscribed ?? 0],
                      ...(shown.reconciliation
                        ? [['table.linesChecked', shown.linesChecked ?? 0]]
                        : []),
                      ['table.failed', shown.failed],
                    ] as Array<[string, number]>
                  ).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{t(key)}</dt>
                      <dd
                        className={cn(
                          'text-foreground tabular-nums',
                          key === 'table.failed' &&
                            value > 0 &&
                            'font-semibold text-status-danger-ink',
                        )}
                      >
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {shown.providerStepsSkipped && (
                <p className="rounded-md bg-status-neutral-soft px-3 py-2 text-sm text-status-neutral-ink">
                  {t('detailProviderSkipped')}
                </p>
              )}

              {shown.error && (
                <p className="rounded-md bg-status-danger-soft px-3 py-2 text-sm text-status-danger-ink">
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
              ) : groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('detailEmpty')}
                </p>
              ) : (
                groups.map(group => (
                  <section key={group.kind} className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">
                      {t(`changeGroup.${group.kind}`, {
                        count: group.changes.length,
                      })}
                    </h3>
                    <ChangeTable kind={group.kind} changes={group.changes} />
                  </section>
                ))
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ChangeTable({
  kind,
  changes,
}: {
  kind: ExpirationChangeKind
  changes: ExpirationChange[]
}) {
  const { t, i18n } = useTranslation('admin/jobs')
  const locale = i18n.language
  const isLine = kind !== 'status'

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">
              {t('change.subscription')}
            </th>
            {isLine ? (
              <>
                <th className="px-3 py-2 font-medium">{t('change.line')}</th>
                <th className="px-3 py-2 font-medium">
                  {t('change.provider')}
                </th>
              </>
            ) : (
              <>
                <th className="px-3 py-2 font-medium">
                  {t('change.transition')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t('change.periodEnd')}
                </th>
              </>
            )}
            <th className="px-3 py-2 font-medium">{t('change.result')}</th>
          </tr>
        </thead>
        <tbody>
          {changes.map(change => (
            <tr
              key={`${change.subscriptionId}-${change.itemId ?? change.to ?? ''}`}
              className="border-b border-border align-top last:border-b-0"
            >
              <td className="px-3 py-2 font-medium whitespace-nowrap">
                <CrmLink
                  url={change.crmUrl}
                  label={`#${change.subscriptionId}`}
                />
              </td>
              {isLine ? (
                <>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {change.itemId ? (
                      <CrmLink
                        url={change.itemCrmUrl ?? null}
                        label={`#${change.itemId}`}
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {change.provider ? t(`provider.${change.provider}`) : '—'}
                  </td>
                </>
              ) : (
                <>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {change.from && change.to
                      ? `${t(`subscriptionStatus.${change.from}`)} → ${t(`subscriptionStatus.${change.to}`)}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {change.periodEnd
                      ? formatSpaDate(change.periodEnd, locale)
                      : '—'}
                  </td>
                </>
              )}
              <td className="px-3 py-2">
                <span
                  className={cn(
                    'font-medium',
                    change.succeeded
                      ? 'text-status-success-ink'
                      : 'text-status-danger-ink',
                  )}
                >
                  {change.succeeded
                    ? t(`change.succeededBy.${kind}`)
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
  )
}

function CrmLink({ url, label }: { url: string | null; label: string }) {
  const { t } = useTranslation('admin/jobs')
  if (!url) return <>{label}</>

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline"
      title={t('change.openCrm')}
    >
      {label}
      <ExternalLink className="size-3" />
    </a>
  )
}
