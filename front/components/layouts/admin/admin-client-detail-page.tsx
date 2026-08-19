'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Settings } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { axiosPortal } from '@/infra/client/axios-portal'
import { formatPortalDate } from '@/lib/format-date'
import {
  type PortalAppContract,
  type PortalDomainDetail,
  THINKZAP_APP_CODE_ID,
} from '@/lib/portal-domains'

type Props = {
  domainId: string
}

export function AdminClientDetailPage({ domainId }: Props) {
  const { t, i18n } = useTranslation('admin/client-detail')
  const { t: tCommon } = useTranslation('common')
  const locale = i18n.language
  const [domain, setDomain] = useState<PortalDomainDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setNotFound(false)
      setHasError(false)

      try {
        const result = await axiosPortal().get<PortalDomainDetail>(
          `/portal/domains/${domainId}`,
        )
        if (!cancelled) {
          setDomain(result)
        }
      } catch (error: unknown) {
        if (!cancelled) {
          const status = (error as { response?: { status?: number } })?.response
            ?.status
          if (status === 404) {
            setNotFound(true)
          } else {
            setHasError(true)
          }
          setDomain(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [domainId])

  /**
   * Os três estados do contrato, distintos na tela.
   *
   * `unavailable` **não** é "sem assinatura": o CRM interno fora do ar não diz nada
   * sobre o cliente, e o suporte abre esta tela justamente quando algo está fora.
   */
  function contractCell(contract: PortalAppContract | undefined) {
    if (!contract) return <span className="text-muted-foreground">—</span>

    if (contract.status === 'no-mirror') {
      return (
        <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {t('contract.noMirror')}
        </span>
      )
    }

    if (contract.status === 'unavailable') {
      return (
        <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {t('contract.unavailable')}
        </span>
      )
    }

    if (contract.subscriptions.length === 0) {
      return (
        <span className="text-xs text-muted-foreground">
          {t('contract.none')}
        </span>
      )
    }

    return (
      <div className="flex flex-col gap-0.5">
        {contract.subscriptions.map(subscription => (
          <span key={subscription.id} className="text-xs text-foreground">
            {t('contract.summary', {
              plano: subscription.planName,
              status: subscription.status,
              linhas: subscription.lineCount,
            })}
          </span>
        ))}
      </div>
    )
  }

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">{tCommon('carregando')}</p>
    )
  }

  if (notFound || hasError || !domain) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/clientes"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'min-h-11',
          )}
        >
          <ArrowLeft className="size-4" />
          {t('back')}
        </Link>
        <div className="admin-card p-6">
          <h2 className="text-lg font-medium text-foreground">
            {t('errorTitle')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('errorDescription')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/clientes"
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'min-h-11',
        )}
      >
        <ArrowLeft className="size-4" />
        {t('back')}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="mt-1 text-lg text-foreground">{domain.name}</p>
      </div>

      <div className="admin-card grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('domain')}
          </p>
          <p className="mt-1 font-medium text-foreground">{domain.name}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('memberId')}
          </p>
          <p className="mt-1 font-mono text-sm text-foreground">
            {domain.memberId}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('createdAt')}
          </p>
          <p className="mt-1 text-foreground">
            {formatPortalDate(domain.createdAt, locale)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('updatedAt')}
          </p>
          <p className="mt-1 text-foreground">
            {formatPortalDate(domain.updatedAt, locale)}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">
          {t('appsTitle')}
        </h2>

        {domain.apps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('appsEmpty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-background">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">
                    {t('table.appName')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('table.appCode')}
                  </th>
                  <th className="px-4 py-3 font-medium">{t('table.status')}</th>
                  <th className="px-4 py-3 font-medium">
                    {t('table.contract')}
                  </th>
                  <th className="px-4 py-3 font-medium">{t('table.email')}</th>
                  <th className="px-4 py-3 font-medium">
                    {t('table.installedAt')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t('table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {domain.apps.map(app => (
                  <tr
                    key={app.id}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {app.appCodeId === THINKZAP_APP_CODE_ID ? (
                        <Link
                          href={`/admin/clientes/${domainId}/apps/${app.id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {app.title}
                        </Link>
                      ) : (
                        app.title
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {app.appCode}
                    </td>
                    <td className="px-4 py-3 text-foreground">{app.status}</td>
                    <td className="px-4 py-3">{contractCell(app.contract)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {app.email}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatPortalDate(app.installedAt, locale)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {app.appCodeId === THINKZAP_APP_CODE_ID ? (
                        <Link
                          href={`/admin/clientes/${domainId}/apps/${app.id}`}
                          className={cn(
                            buttonVariants({ variant: 'outline', size: 'sm' }),
                          )}
                        >
                          <Settings className="size-3.5" />
                          {t('table.settings')}
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
