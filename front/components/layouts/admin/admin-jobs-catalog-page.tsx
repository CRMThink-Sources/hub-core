'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ChevronRight, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ADMIN_JOBS } from '@/lib/admin-jobs'
import { formatPortalDate, formatRelativeInstant } from '@/lib/format-date'
import {
  AdminJobHealthBadge,
  AdminJobRunStrip,
  JOB_RUN_STRIP_SIZE,
  useAdminJobsHealth,
} from './admin-jobs-health'
import { AdminPageHeader } from './ui/admin-page-header'

/**
 * `/admin/jobs`: um job por linha, num só bloco. Linha e não card porque o catálogo
 * cresce (verificação completa, sincronização Stripe) e linhas não deixam órfãos.
 */
export function AdminJobsCatalogPage() {
  const { t, i18n } = useTranslation('admin/jobs')
  const { states, reload } = useAdminJobsHealth()

  return (
    <div className="space-y-6">
      <AdminPageHeader title={t('title')} description={t('description')} />

      <section
        aria-label={t('catalog.count', { count: ADMIN_JOBS.length })}
        className="divide-y divide-border rounded-lg border border-border bg-card"
      >
        {ADMIN_JOBS.map(job => {
          const state = states[job.id] ?? { status: 'loading' }
          const href = `/admin/jobs/${job.id}`

          return (
            <article
              key={job.id}
              className="relative grid gap-4 px-5 py-5 transition-colors has-[a:hover]:bg-muted/50 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(11rem,auto)] md:items-center md:gap-8"
            >
              <div className="min-w-0">
                <h2 className="text-base font-medium text-foreground">
                  <Link
                    href={href}
                    className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring/50"
                  >
                    {t(job.nameKey)}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(job.descriptionKey)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t(job.scheduleKey)}
                </p>
              </div>

              {state.status === 'error' ? (
                <div className="relative z-10 flex flex-wrap items-center gap-3 md:col-span-2 md:justify-end">
                  <p className="text-sm text-muted-foreground">
                    {t('catalog.unavailable')}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reload(job.id)}
                  >
                    <RotateCw className="size-3.5" />
                    {t('retry')}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="min-w-0">
                    {state.status === 'loading' ? (
                      <div aria-hidden className="h-6 rounded-[2px] bg-muted" />
                    ) : (
                      <AdminJobRunStrip runs={state.runs} />
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('strip.caption', { count: JOB_RUN_STRIP_SIZE })}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 md:justify-end">
                    <div className="flex flex-col gap-1 md:items-end">
                      {state.status === 'loading' ? (
                        <>
                          <span
                            aria-hidden
                            className="h-5 w-24 rounded bg-muted"
                          />
                          <span
                            aria-hidden
                            className="h-4 w-32 rounded bg-muted"
                          />
                        </>
                      ) : (
                        <>
                          <AdminJobHealthBadge health={state.health} />
                          <p className="text-xs text-muted-foreground">
                            {state.latest ? (
                              <>
                                {t('catalog.lastRun')}{' '}
                                <time
                                  dateTime={state.latest.startedAt}
                                  title={formatPortalDate(
                                    state.latest.startedAt,
                                    i18n.language,
                                  )}
                                >
                                  {formatRelativeInstant(
                                    state.latest.startedAt,
                                    state.checkedAt,
                                    i18n.language,
                                  )}
                                </time>
                              </>
                            ) : (
                              t('catalog.lastRunNever')
                            )}
                          </p>
                        </>
                      )}
                    </div>
                    <ChevronRight
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  </div>
                </>
              )}
            </article>
          )
        })}
      </section>
    </div>
  )
}
