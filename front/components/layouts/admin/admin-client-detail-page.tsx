'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  RotateCw,
  SearchX,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { axiosPortal } from '@/infra/client/axios-portal'
import { formatPortalDate, formatSpaDate } from '@/lib/format-date'
import type {
  PortalAppContract,
  PortalDomainApp,
  PortalDomainDetail,
} from '@/lib/portal-domains'
import {
  APP_STATUS,
  MIRROR_STATUS,
  STATUS_NAMESPACE,
  SUBSCRIPTION_STATUS,
  statusMeta,
} from '@/lib/portal-status'
import { AdminEmptyState } from './ui/admin-empty-state'
import { AdminPageHeader } from './ui/admin-page-header'
import { AdminPanel } from './ui/admin-panel'
import { AdminStatCard, AdminStatGroup } from './ui/admin-stat-card'
import { AdminStatusBadge } from './ui/admin-status-badge'

type Props = {
  domainId: string
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error' }
  | { kind: 'ready'; domain: PortalDomainDetail }

export function AdminClientDetailPage({ domainId }: Props) {
  const { t } = useTranslation('admin/client-detail')
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  const load = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      setState({ kind: 'loading' })
      try {
        const domain = await axiosPortal().get<PortalDomainDetail>(
          `/portal/domains/${domainId}`,
        )
        if (!isCancelled()) setState({ kind: 'ready', domain })
      } catch (error: unknown) {
        if (isCancelled()) return
        const status = (error as { response?: { status?: number } })?.response
          ?.status
        setState({ kind: status === 404 ? 'not-found' : 'error' })
      }
    },
    [domainId],
  )

  useEffect(() => {
    let cancelled = false
    void load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  if (state.kind === 'ready') {
    return <AdminClientDetailView domain={state.domain} />
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumb={[{ label: t('breadcrumb'), href: '/admin/clientes' }]}
        title={
          state.kind === 'loading' ? (
            <span aria-hidden className="block h-8 w-64 rounded-md bg-muted" />
          ) : state.kind === 'not-found' ? (
            t('notFoundTitle')
          ) : (
            t('errorTitle')
          )
        }
      />

      {state.kind === 'loading' && <ClientDetailSkeleton />}

      {state.kind === 'not-found' && (
        <AdminEmptyState
          icon={SearchX}
          title={t('notFoundTitle')}
          description={t('notFoundDescription')}
          action={
            <Link
              href="/admin/clientes"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ArrowLeft className="size-3.5" />
              {t('back')}
            </Link>
          }
        />
      )}

      {state.kind === 'error' && (
        <AdminEmptyState
          icon={AlertTriangle}
          title={t('errorTitle')}
          description={t('errorDescription')}
          action={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RotateCw className="size-3.5" />
              {t('retry')}
            </Button>
          }
        />
      )}
    </div>
  )
}

/** O detalhe pronto: cabeçalho, indicadores, identificação e aplicações. Só props. */
export function AdminClientDetailView({
  domain,
}: {
  domain: PortalDomainDetail
}) {
  const { t, i18n } = useTranslation('admin/client-detail')
  const locale = i18n.language
  const summary = domain.summary

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumb={[
          { label: t('breadcrumb'), href: '/admin/clientes' },
          { label: domain.name },
        ]}
        title={<span className="break-all">{domain.name}</span>}
        description={
          <span className="font-mono text-xs">{domain.memberId}</span>
        }
        actions={
          <a
            href={`https://${domain.name}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('openPortalLabel', { domain: domain.name })}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ExternalLink className="size-3.5" />
            {t('openPortal')}
          </a>
        }
      />

      <AdminStatGroup label={t('stats.label')}>
        <AdminStatCard
          label={t('stats.apps')}
          value={summary?.apps ?? domain.apps.length}
          locale={locale}
        />
        <AdminStatCard
          label={t('stats.activeSubscriptions')}
          value={summary?.activeSubscriptions ?? null}
          hint={summary?.incomplete ? t('stats.incomplete') : undefined}
          locale={locale}
        />
        <AdminStatCard
          label={t('stats.lines')}
          value={summary?.lines ?? null}
          hint={summary?.incomplete ? t('stats.incomplete') : undefined}
          locale={locale}
        />
        <AdminStatCard
          label={t('stats.mcpUsers')}
          value={summary?.mcpUsers ?? domain.mcpUserCount}
          locale={locale}
        />
      </AdminStatGroup>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="client-apps-title" className="space-y-3">
          <h2
            id="client-apps-title"
            className="text-sm font-medium text-foreground"
          >
            {t('appsTitle')}
          </h2>
          {domain.apps.length === 0 ? (
            <AdminEmptyState title={t('appsEmpty')} />
          ) : (
            <ul className="grid gap-3 xl:grid-cols-2">
              {domain.apps.map(app => (
                <li key={app.id}>
                  <AdminClientAppCard domainId={domain.id} app={app} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <AdminPanel title={t('identity.title')} className="self-start">
          <dl className="space-y-3 text-sm">
            <IdentityRow label={t('identity.domain')}>
              <span className="break-all">{domain.name}</span>
            </IdentityRow>
            <IdentityRow label={t('identity.memberId')}>
              <span className="font-mono text-xs break-all">
                {domain.memberId}
              </span>
            </IdentityRow>
            <IdentityRow label={t('identity.createdAt')}>
              {formatPortalDate(domain.createdAt, locale)}
            </IdentityRow>
            <IdentityRow label={t('identity.updatedAt')}>
              {formatPortalDate(domain.updatedAt, locale)}
            </IdentityRow>
          </dl>
        </AdminPanel>
      </div>
    </div>
  )
}

function IdentityRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  )
}

/** Card de uma instalação: identidade, estado e contrato. O card inteiro abre a app. */
export function AdminClientAppCard({
  domainId,
  app,
}: {
  domainId: string
  app: PortalDomainApp
}) {
  const { t, i18n } = useTranslation('admin/client-detail')
  const { t: tStatus } = useTranslation(STATUS_NAMESPACE)
  const appStatus = statusMeta(APP_STATUS, app.status)
  const mirror = statusMeta(MIRROR_STATUS, app.mirror)

  return (
    <article className="relative flex h-full flex-col gap-4 rounded-lg border border-border bg-card px-5 py-4 transition-colors has-[a:hover]:bg-muted/40">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-medium text-foreground">
            <Link
              href={`/admin/clientes/${domainId}/apps/${app.id}`}
              aria-label={t('app.openLabel', { title: app.title })}
              className="rounded-sm after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50"
            >
              {app.title}
            </Link>
          </h3>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {app.appCode}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <AdminStatusBadge tone={appStatus.tone}>
            {tStatus(appStatus.labelKey)}
          </AdminStatusBadge>
          {app.mirror !== 'linked' && (
            <AdminStatusBadge tone={mirror.tone}>
              {tStatus(mirror.labelKey)}
            </AdminStatusBadge>
          )}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">
            {t('app.installedBy')}
          </dt>
          <dd className="mt-0.5 truncate text-foreground" title={app.email}>
            {app.email}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            {t('app.installedAt')}
          </dt>
          <dd className="mt-0.5 text-foreground tabular-nums">
            {formatPortalDate(app.installedAt, i18n.language)}
          </dd>
        </div>
      </dl>

      <div className="border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">{t('app.contract')}</p>
        <div className="mt-1.5">
          <ContractSummary contract={app.contract} />
        </div>
      </div>
    </article>
  )
}

/**
 * Os estados do contrato, cada um com rótulo próprio. `unavailable` não é "sem
 * assinatura": o CRM interno fora do ar não diz nada sobre o cliente.
 */
export function ContractSummary({
  contract,
}: {
  contract: PortalAppContract | undefined
}) {
  const { t, i18n } = useTranslation('admin/client-detail')
  const { t: tStatus } = useTranslation(STATUS_NAMESPACE)

  if (!contract) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  if (contract.status === 'no-mirror') {
    return (
      <p className="text-sm text-status-warning-ink">
        {t('contract.noMirror')}
      </p>
    )
  }

  if (contract.status === 'unavailable') {
    return (
      <p className="text-sm text-muted-foreground">
        {t('contract.unavailable')}
      </p>
    )
  }

  if (contract.subscriptions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('contract.none')}</p>
  }

  return (
    <ul className="space-y-1.5">
      {contract.subscriptions.map(subscription => {
        const status = statusMeta(SUBSCRIPTION_STATUS, subscription.status)

        return (
          <li
            key={subscription.id}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
          >
            <AdminStatusBadge tone={status.tone}>
              {tStatus(status.labelKey)}
            </AdminStatusBadge>
            <span className="font-medium text-foreground">
              {subscription.planName}
            </span>
            <span className="text-muted-foreground">
              {t('contract.lines', { count: subscription.lineCount })}
              {' · '}
              {t('contract.until', {
                date: formatSpaDate(
                  subscription.currentPeriodEnd,
                  i18n.language,
                ),
              })}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function ClientDetailSkeleton() {
  return (
    <div aria-busy className="space-y-6">
      <div className="grid h-[7.25rem] grid-cols-2 rounded-lg border border-border bg-card lg:grid-cols-4" />
      <div className="grid gap-3 xl:grid-cols-2">
        {[0, 1].map(index => (
          <div
            key={index}
            className="h-48 rounded-lg border border-border bg-card"
          />
        ))}
      </div>
    </div>
  )
}
