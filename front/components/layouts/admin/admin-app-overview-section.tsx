'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Link2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { axiosPortal } from '@/infra/client/axios-portal'
import { formatPortalDate } from '@/lib/format-date'
import {
  readPortalError,
  type AppSubscription,
  type LinkMirrorResponse,
  type ListAppSubscriptionsResponse,
  type PortalAppDetail,
  type PortalAppMirror,
} from '@/lib/portal-domains'
import {
  MIRROR_STATUS,
  STATUS_NAMESPACE,
  SUBSCRIPTION_STATUS,
  statusMeta,
} from '@/lib/portal-status'
import { AdminPanel } from './ui/admin-panel'
import { AdminStatusBadge } from './ui/admin-status-badge'

type Props = {
  app: PortalAppDetail
  /** Depois de vincular o espelho: o cabeçalho e o contrato mudam. */
  onMirrorLinked: () => void
  onOpenSubscriptions: () => void
}

type ContractState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'no-mirror' }
  | { kind: 'ready'; subscriptions: AppSubscription[] }

/** Aba "Visão geral": dados da instalação, espelho na SPA 1060 e resumo do contrato. */
export function AdminAppOverviewSection({
  app,
  onMirrorLinked,
  onOpenSubscriptions,
}: Props) {
  const { t } = useTranslation('admin/app-settings')
  const [contract, setContract] = useState<ContractState>({ kind: 'loading' })
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  const loadContract = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      setContract({ kind: 'loading' })
      try {
        const output = await axiosPortal().get<ListAppSubscriptionsResponse>(
          `/portal/apps/${app.id}/subscriptions`,
        )
        if (isCancelled()) return
        setContract(
          output.mirrored
            ? { kind: 'ready', subscriptions: output.subscriptions }
            : { kind: 'no-mirror' },
        )
      } catch {
        if (!isCancelled()) setContract({ kind: 'error' })
      }
    },
    [app.id],
  )

  useEffect(() => {
    let cancelled = false
    void loadContract(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [loadContract, app.spaId])

  const linkMirror = async () => {
    setLinking(true)
    setLinkError(null)
    try {
      const result = await axiosPortal().post<LinkMirrorResponse>(
        `/portal/apps/${app.id}/link-mirror`,
      )
      toast.success(t('overview.linkMirrorSuccess', { spaId: result.spaId }))
      onMirrorLinked()
    } catch (error) {
      setLinkError(linkMirrorErrorMessage(error, t))
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <InstallationPanel app={app} />
      <MirrorPanel
        mirror={app.mirror}
        linking={linking}
        error={linkError}
        onLink={() => void linkMirror()}
      />
      <ContractOverview
        state={contract}
        onOpenSubscriptions={onOpenSubscriptions}
        className="lg:col-span-2"
      />
    </div>
  )
}

/** Mensagem do `409` de "Vincular espelho", com os ids quando o motivo os tem. */
export function linkMirrorErrorMessage(
  error: unknown,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const { reason, ids } = readPortalError(error)
  const known = [
    'already-linked',
    'unverified',
    'not-found',
    'ambiguous',
    'taken',
  ]

  return reason && known.includes(reason)
    ? t(`overview.linkMirrorError.${reason}`, { ids: ids.join(', ') })
    : t('overview.linkMirrorError.generic')
}

export function InstallationPanel({ app }: { app: PortalAppDetail }) {
  const { t, i18n } = useTranslation('admin/app-settings')

  return (
    <AdminPanel title={t('overview.installationTitle')}>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Row label={t('overview.email')}>
          <span className="break-all">{app.email}</span>
        </Row>
        <Row label={t('overview.installedAt')}>
          {formatPortalDate(app.installedAt, i18n.language)}
        </Row>
        <Row label={t('overview.locale')}>
          {app.locale ? app.locale.toUpperCase() : t('overview.localeNone')}
        </Row>
        <Row label={t('overview.spaId')}>
          <span className="font-mono text-xs">{app.spaId ?? '—'}</span>
        </Row>
        <Row label={t('overview.appId')} className="sm:col-span-2">
          <span className="font-mono text-xs break-all">{app.id}</span>
        </Row>
      </dl>
    </AdminPanel>
  )
}

/** Estado do espelho com o impacto dele, e "Vincular espelho" quando há o que religar. */
export function MirrorPanel({
  mirror,
  linking,
  error,
  onLink,
}: {
  mirror: PortalAppMirror
  linking: boolean
  error: string | null
  onLink: () => void
}) {
  const { t } = useTranslation('admin/app-settings')
  const { t: tStatus } = useTranslation(STATUS_NAMESPACE)
  const meta = statusMeta(MIRROR_STATUS, mirror)
  const canLink = mirror === 'no-mirror' || mirror === 'mirror-missing'

  return (
    <AdminPanel
      title={t('overview.mirrorTitle')}
      action={
        <AdminStatusBadge tone={meta.tone}>
          {tStatus(meta.labelKey)}
        </AdminStatusBadge>
      }
    >
      <p className="text-sm text-muted-foreground">
        {t(`overview.mirrorImpact.${mirror}`)}
      </p>

      {canLink && (
        <div className="mt-4 space-y-2">
          <Button size="sm" onClick={onLink} disabled={linking}>
            {linking ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Link2 className="size-3.5" />
            )}
            {t('overview.linkMirror')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t('overview.linkMirrorHint')}
          </p>
          {error && (
            <p
              role="alert"
              className="rounded-md bg-status-danger-soft px-3 py-2 text-sm text-status-danger-ink"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </AdminPanel>
  )
}

/** Assinaturas por status e linhas contratadas. O detalhe é da aba Assinaturas. */
export function ContractOverview({
  state,
  onOpenSubscriptions,
  className,
}: {
  state: ContractState
  onOpenSubscriptions: () => void
  className?: string
}) {
  const { t } = useTranslation('admin/app-settings')
  const { t: tStatus } = useTranslation(STATUS_NAMESPACE)

  const body = (() => {
    switch (state.kind) {
      case 'loading':
        return (
          <p className="text-sm text-muted-foreground">
            {t('overview.contractLoading')}
          </p>
        )
      case 'error':
        return (
          <p className="text-sm text-muted-foreground">
            {t('overview.contractUnavailable')}
          </p>
        )
      case 'no-mirror':
        return (
          <p className="text-sm text-status-warning-ink">
            {t('overview.contractNoMirror')}
          </p>
        )
      case 'ready': {
        if (state.subscriptions.length === 0) {
          return (
            <p className="text-sm text-muted-foreground">
              {t('overview.contractEmpty')}
            </p>
          )
        }

        const byStatus = new Map<string, number>()
        for (const subscription of state.subscriptions) {
          byStatus.set(
            subscription.status,
            (byStatus.get(subscription.status) ?? 0) + 1,
          )
        }

        return (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <ul className="flex flex-wrap gap-2">
              {[...byStatus.entries()].map(([status, count]) => {
                const meta = statusMeta(SUBSCRIPTION_STATUS, status)
                return (
                  <li key={status}>
                    <AdminStatusBadge tone={meta.tone}>
                      {count} · {tStatus(meta.labelKey)}
                    </AdminStatusBadge>
                  </li>
                )
              })}
            </ul>
            <span className="text-sm text-muted-foreground">
              {t('overview.contractLines', {
                count: contractedLines(state.subscriptions),
              })}
            </span>
          </div>
        )
      }
    }
  })()

  return (
    <AdminPanel
      title={t('overview.contractTitle')}
      className={className}
      action={
        <Button variant="ghost" size="sm" onClick={onOpenSubscriptions}>
          {t('overview.contractSeeAll')}
        </Button>
      }
    >
      {body}
    </AdminPanel>
  )
}

/** Linhas das assinaturas não canceladas; item `NONE` é cobrança sem linha. */
export const contractedLines = (subscriptions: AppSubscription[]): number =>
  subscriptions
    .filter(subscription => subscription.status !== 'cancelled')
    .flatMap(subscription => subscription.items)
    .filter(item => item.metadata.provider !== 'NONE').length

function Row({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  )
}
