'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatPortalDate } from '@/lib/format-date'
import type { PortalDomainDetail } from '@/lib/portal-domains'

type Props = {
  domains: PortalDomainDetail[]
  hasSearch?: boolean
}

export function AdminClientsTable({ domains, hasSearch }: Props) {
  const { t, i18n } = useTranslation('admin/clients')
  const locale = i18n.language
  const router = useRouter()

  if (domains.length === 0 && hasSearch) {
    return (
      <div className="admin-card p-6">
        <p className="text-sm text-muted-foreground">{t('searchNoResults')}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">{t('table.domain')}</th>
            <th className="px-4 py-3 font-medium">{t('table.memberId')}</th>
            <th className="px-4 py-3 font-medium">{t('table.apps')}</th>
            <th className="px-4 py-3 font-medium">{t('table.createdAt')}</th>
            <th className="px-4 py-3 text-right font-medium">
              {t('table.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {domains.map(domain => (
            <tr
              key={domain.id}
              className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/30"
              onClick={() => router.push(`/admin/clientes/${domain.id}`)}
            >
              <td className="px-4 py-3 font-medium text-foreground">
                {domain.name}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {domain.memberId}
              </td>
              <td className="px-4 py-3">
                {domain.apps.length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    {t('noApps')}
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {domain.apps.map(app => (
                      <span
                        key={app.id}
                        className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                        title={app.appCode}
                      >
                        {app.appName}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatPortalDate(domain.createdAt, locale)}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/clientes/${domain.id}`}
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                  )}
                >
                  {t('table.view')}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
