'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  RotateCw,
  Timer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePortalSession } from '@/providers/portal-session-provider'
import { ADMIN_JOBS, jobHealthNeedsAttention } from '@/lib/admin-jobs'
import { formatPortalDate, formatRelativeInstant } from '@/lib/format-date'
import { listOutboxFailures } from '@/lib/outbox-failures'
import {
  getDashboardSummary,
  type DashboardSummary,
} from '@/lib/portal-dashboard'
import {
  AdminJobHealthBadge,
  AdminJobRunStrip,
  useAdminJobsHealth,
} from './admin-jobs-health'
import { AdminPageHeader } from './ui/admin-page-header'
import { AdminPanel } from './ui/admin-panel'
import { AdminStatCard, AdminStatGroup } from './ui/admin-stat-card'

type Loadable<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: T }

/** Uma fonte de dados da home com o próprio estado: a falha de uma não derruba as outras. */
function useLoadable<T>(load: () => Promise<T>) {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading' })

  const run = useCallback(() => {
    setState({ status: 'loading' })
    load()
      .then(data => setState({ status: 'ready', data }))
      .catch(() => setState({ status: 'error' }))
  }, [load])

  useEffect(() => {
    run()
  }, [run])

  return [state, run] as const
}

const loadOutboxFailureTotal = () =>
  listOutboxFailures({ page: 1, limit: 1 }).then(result => result.total)

function greetingKey(hour: number) {
  if (hour < 12) return 'greetingMorning'
  if (hour < 18) return 'greetingAfternoon'
  return 'greetingEvening'
}

export function AdminHomeContent() {
  const { t, i18n } = useTranslation('admin/home')
  const { t: tJobs } = useTranslation('admin/jobs')
  const { session } = usePortalSession()
  const locale = i18n.language

  const [summary, reloadSummary] =
    useLoadable<DashboardSummary>(getDashboardSummary)
  const [outbox, reloadOutbox] = useLoadable<number>(loadOutboxFailureTotal)
  const { states: jobStates, reload: reloadJob } = useAdminJobsHealth()

  // Hora/data só no cliente: o servidor não sabe o fuso de quem olha.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => setNow(new Date()), [])

  const jobsNeedingAttention = ADMIN_JOBS.filter(job => {
    const state = jobStates[job.id]
    return state?.status === 'ready' && jobHealthNeedsAttention(state.health)
  })
  const outboxCount = outbox.status === 'ready' ? outbox.data : 0
  const attentionCount = jobsNeedingAttention.length + (outboxCount > 0 ? 1 : 0)
  const attentionSettled =
    outbox.status !== 'loading' &&
    ADMIN_JOBS.every(job => jobStates[job.id]?.status !== 'loading')

  const subscriptions =
    summary.status === 'ready' ? summary.data.subscriptions : null
  const subscriptionState =
    summary.status === 'loading'
      ? 'loading'
      : subscriptions
        ? 'ready'
        : 'unavailable'

  const dateLine = now
    ? new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(now)
    : null

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={
          now
            ? t(greetingKey(now.getHours()), { name: session?.name ?? '' })
            : ' '
        }
        description={
          <>
            {dateLine && (
              <span className="first-letter:uppercase">{dateLine}</span>
            )}
            {attentionSettled && (
              <>
                {dateLine && ' · '}
                <span
                  className={
                    attentionCount > 0
                      ? 'font-medium text-status-warning-ink'
                      : undefined
                  }
                >
                  {attentionCount > 0
                    ? t('attentionCount', { count: attentionCount })
                    : t('allClearShort')}
                </span>
              </>
            )}
          </>
        }
      />

      <div className="space-y-2">
        <AdminStatGroup label={t('kpi.label')}>
          <AdminStatCard
            label={t('kpi.clients')}
            href="/admin/clientes"
            hint={t('kpi.clientsHint')}
            locale={locale}
            state={
              summary.status === 'loading'
                ? 'loading'
                : summary.status === 'error'
                  ? 'unavailable'
                  : 'ready'
            }
            value={summary.status === 'ready' ? summary.data.clients : null}
            unavailableLabel={t('kpi.unavailable')}
          />
          <AdminStatCard
            label={t('kpi.active')}
            locale={locale}
            state={subscriptionState}
            value={subscriptions?.active}
            unavailableLabel={t('kpi.unavailable')}
          />
          <AdminStatCard
            label={t('kpi.pastDue')}
            hint={t('kpi.pastDueHint')}
            locale={locale}
            state={subscriptionState}
            value={subscriptions?.pastDue}
            unavailableLabel={t('kpi.unavailable')}
          />
          <AdminStatCard
            label={t('kpi.trialing')}
            locale={locale}
            state={subscriptionState}
            value={subscriptions?.trialing}
            unavailableLabel={t('kpi.unavailable')}
          />
        </AdminStatGroup>

        <div className="flex min-h-5 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {summary.status === 'ready' && subscriptions && now && (
            <span title={formatPortalDate(summary.data.generatedAt, locale)}>
              {t('kpi.countedAt', {
                when: formatRelativeInstant(
                  summary.data.generatedAt,
                  now,
                  locale,
                ),
              })}
            </span>
          )}
          {(summary.status === 'error' ||
            (summary.status === 'ready' && !subscriptions)) && (
            <>
              <span>{t('kpi.subscriptionsUnavailable')}</span>
              <button
                type="button"
                onClick={reloadSummary}
                className="rounded-sm font-medium text-foreground underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {t('retry')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <AdminPanel
          className="lg:col-span-3"
          title={t('jobsPanel.title')}
          action={
            <Link
              href="/admin/jobs"
              className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {t('jobsPanel.viewAll')}
              <ArrowRight className="size-3.5" />
            </Link>
          }
          bodyClassName="px-0 pb-2"
        >
          <ul className="divide-y divide-border">
            {ADMIN_JOBS.map(job => {
              const state = jobStates[job.id] ?? { status: 'loading' }
              return (
                <li key={job.id} className="relative">
                  <div className="grid gap-3 px-5 py-3 has-[a:hover]:bg-muted/50 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center sm:gap-6">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/jobs/${job.id}`}
                        className="text-sm font-medium text-foreground after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50"
                      >
                        {tJobs(job.nameKey)}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {state.status === 'ready' ? (
                          <>
                            <AdminJobHealthBadge health={state.health} />
                            <span aria-hidden>·</span>
                            <span>
                              {state.latest
                                ? formatRelativeInstant(
                                    state.latest.startedAt,
                                    state.checkedAt,
                                    locale,
                                  )
                                : t('jobsPanel.neverRan')}
                            </span>
                          </>
                        ) : state.status === 'error' ? (
                          <span>{t('jobsPanel.unavailable')}</span>
                        ) : (
                          <span
                            aria-hidden
                            className="h-4 w-32 rounded bg-muted"
                          />
                        )}
                      </div>
                    </div>
                    {state.status === 'error' ? (
                      <div className="relative z-10 sm:justify-self-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reloadJob(job.id)}
                        >
                          <RotateCw className="size-3.5" />
                          {t('retry')}
                        </Button>
                      </div>
                    ) : state.status === 'ready' ? (
                      <AdminJobRunStrip runs={state.runs} />
                    ) : (
                      <div aria-hidden className="h-6 rounded-[2px] bg-muted" />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </AdminPanel>

        <AdminPanel className="lg:col-span-2" title={t('attention.title')}>
          <ul className="flex flex-col gap-2">
            {outbox.status === 'error' && (
              <AttentionRow
                icon={AlertTriangle}
                tone="neutral"
                label={t('attention.outboxUnavailable')}
                action={
                  <button
                    type="button"
                    onClick={reloadOutbox}
                    className="relative z-10 rounded-sm text-sm font-medium text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {t('retry')}
                  </button>
                }
              />
            )}
            {outboxCount > 0 && (
              <AttentionRow
                icon={AlertTriangle}
                tone="danger"
                href="/admin/falhas-envio"
                label={t('attention.outboxFailures', { count: outboxCount })}
              />
            )}
            {jobsNeedingAttention.map(job => {
              const state = jobStates[job.id]
              if (state?.status !== 'ready') return null
              return (
                <AttentionRow
                  key={job.id}
                  icon={Timer}
                  tone={state.health === 'failing' ? 'danger' : 'warning'}
                  href={`/admin/jobs/${job.id}`}
                  label={tJobs(job.nameKey)}
                  meta={
                    <AdminJobHealthBadge health={state.health} variant="pill" />
                  }
                />
              )
            })}
            {!attentionSettled && (
              <li className="text-sm text-muted-foreground">
                {t('attention.checking')}
              </li>
            )}
            {attentionSettled &&
              attentionCount === 0 &&
              outbox.status !== 'error' && (
                <li className="flex items-start gap-3 rounded-md bg-status-success-soft px-3 py-3 text-sm text-status-success-ink">
                  <CheckCircle2
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0"
                  />
                  {t('attention.allClear')}
                </li>
              )}
          </ul>
        </AdminPanel>
      </div>
    </div>
  )
}

const ICON_TONE = {
  danger: 'text-status-danger',
  warning: 'text-status-warning',
  neutral: 'text-muted-foreground',
} as const

function AttentionRow({
  icon: Icon,
  tone,
  label,
  href,
  meta,
  action,
}: {
  icon: typeof AlertTriangle
  tone: keyof typeof ICON_TONE
  label: string
  href?: string
  meta?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <li className="relative flex min-h-11 items-center gap-3 rounded-md border border-border px-3 py-2 has-[a:hover]:bg-muted/50">
      <Icon aria-hidden className={`size-4 shrink-0 ${ICON_TONE[tone]}`} />
      {href ? (
        <Link
          href={href}
          className="min-w-0 flex-1 text-sm text-foreground after:absolute after:inset-0 after:rounded-md after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50"
        >
          {label}
        </Link>
      ) : (
        <span className="min-w-0 flex-1 text-sm text-foreground">{label}</span>
      )}
      {meta}
      {action}
      {href && (
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground"
        />
      )}
    </li>
  )
}
