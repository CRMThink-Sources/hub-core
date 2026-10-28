'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { formatPortalDate } from '@/lib/format-date'
import type { PortalDomainApp, PortalDomainDetail } from '@/lib/portal-domains'
import {
  MIRROR_STATUS,
  STATUS_NAMESPACE,
  statusMeta,
} from '@/lib/portal-status'
import { AdminStatusBadge } from './ui/admin-status-badge'

type Props = {
  domains: PortalDomainDetail[]
}

const clientHref = (domain: PortalDomainDetail) =>
  `/admin/clientes/${domain.id}`

/**
 * Link que cobre a linha (ou o card) inteiro: clique em qualquer ponto abre o cliente, e
 * o teclado ganha foco, Enter e clique do meio sem `onClick` em `<tr>`.
 */
const STRETCHED_LINK =
  "rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"

/**
 * Tabela de clientes a partir de `md`; lista de cards abaixo disso, para não haver
 * rolagem horizontal da página no celular.
 */
export function AdminClientsTable({ domains }: Props) {
  const { t, i18n } = useTranslation('admin/clients')
  const locale = i18n.language

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <table
          aria-label={t('table.label')}
          className="w-full text-left text-sm"
        >
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="px-5 py-3 font-medium">
                {t('table.domain')}
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                {t('table.memberId')}
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                {t('table.apps')}
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                {t('table.createdAt')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {domains.map(domain => (
              <tr
                key={domain.id}
                className="relative align-top transition-colors has-[a:hover]:bg-muted/50"
              >
                <td className="px-5 py-3.5 font-medium text-foreground">
                  <Link href={clientHref(domain)} className={STRETCHED_LINK}>
                    {domain.name}
                  </Link>
                </td>
                <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                  {domain.memberId}
                </td>
                <td className="px-5 py-3.5">
                  <AppChips apps={domain.apps} />
                </td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatPortalDate(domain.createdAt, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul
        aria-label={t('table.label')}
        className="divide-y divide-border rounded-lg border border-border bg-card md:hidden"
      >
        {domains.map(domain => (
          <li
            key={domain.id}
            className="relative px-4 py-4 transition-colors has-[a:hover]:bg-muted/50"
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={clientHref(domain)}
                className={`${STRETCHED_LINK} min-w-0 font-medium break-all text-foreground`}
              >
                {domain.name}
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatPortalDate(domain.createdAt, locale)}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-xs break-all text-muted-foreground">
              {domain.memberId}
            </p>
            <div className="mt-3">
              <AppChips apps={domain.apps} />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Título de cada instalação e, quando o espelho não está ok, o estado dele. */
export function AppChips({ apps }: { apps: PortalDomainApp[] }) {
  const { t } = useTranslation('admin/clients')
  const { t: tStatus } = useTranslation(STATUS_NAMESPACE)

  if (apps.length === 0) {
    return <span className="text-sm text-muted-foreground">{t('noApps')}</span>
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {apps.map(app => {
        const mirror = statusMeta(MIRROR_STATUS, app.mirror)

        return (
          <li
            key={app.id}
            title={app.appCode}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground"
          >
            {app.title}
            {app.mirror !== 'linked' && (
              <span title={t(`mirrorHint.${app.mirror}`)}>
                <AdminStatusBadge tone={mirror.tone} className="h-5 px-2">
                  {tStatus(mirror.labelKey)}
                </AdminStatusBadge>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
