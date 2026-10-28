'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  RotateCw,
  SearchX,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { axiosPortal } from '@/infra/client/axios-portal'
import {
  APP_TAB_LABEL_KEY,
  APP_TAB_PARAM,
  GENERAL_TABS,
  TECHNICAL_TABS,
  THINKZAP_TABS,
  isTechnicalTab,
  resolveAppTab,
  type AppTab,
} from '@/lib/admin-app-tabs'
import {
  THINKZAP_APP_CODE_ID,
  type PortalAppDetail,
} from '@/lib/portal-domains'
import {
  APP_STATUS,
  MIRROR_STATUS,
  STATUS_NAMESPACE,
  statusMeta,
} from '@/lib/portal-status'
import { AdminAppOverviewSection } from './admin-app-overview-section'
import { AdminAppSubscriptionsSection } from './admin-app-subscriptions-section'
import { AdminClientBizprocRobotsSection } from './admin-client-bizproc-robots-section'
import { AdminClientDeploymentSection } from './admin-client-deployment-section'
import { AdminClientInstancesSection } from './admin-client-instances-section'
import { AdminClientPlacementsSection } from './admin-client-placements-section'
import { AdminClientSmsSendersSection } from './admin-client-sms-senders-section'
import { AdminEmptyState } from './ui/admin-empty-state'
import { AdminPageHeader } from './ui/admin-page-header'
import { AdminStatusBadge } from './ui/admin-status-badge'

type Props = {
  domainId: string
  appId: string
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error' }
  | { kind: 'ready'; app: PortalAppDetail }

/**
 * Tela de uma aplicação instalada: abre para qualquer app. As abas de ThinkZap (Linhas e
 * o grupo técnico) só aparecem para o ThinkZap.
 */
export function AdminAppDetailPage({ domainId, appId }: Props) {
  const { t } = useTranslation('admin/app-settings')
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  const load = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      try {
        const app = await axiosPortal().get<PortalAppDetail>(
          `/portal/apps/${appId}`,
        )
        if (!isCancelled()) setState({ kind: 'ready', app })
      } catch (error: unknown) {
        if (isCancelled()) return
        const status = (error as { response?: { status?: number } })?.response
          ?.status
        setState({ kind: status === 404 ? 'not-found' : 'error' })
      }
    },
    [appId],
  )

  useEffect(() => {
    let cancelled = false
    void load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  if (state.kind === 'ready') {
    return (
      <AppDetailReady
        domainId={domainId}
        app={state.app}
        onReload={() => void load()}
      />
    )
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumb={[
          { label: t('detail.breadcrumb'), href: '/admin/clientes' },
        ]}
        title={
          state.kind === 'loading' ? (
            <span aria-hidden className="block h-8 w-64 rounded-md bg-muted" />
          ) : state.kind === 'not-found' ? (
            t('detail.notFoundTitle')
          ) : (
            t('detail.errorTitle')
          )
        }
      />

      {state.kind === 'loading' && (
        <div
          aria-busy
          className="h-64 rounded-lg border border-border bg-card"
        />
      )}

      {state.kind === 'not-found' && (
        <AdminEmptyState
          icon={SearchX}
          title={t('detail.notFoundTitle')}
          description={t('detail.notFoundDescription')}
          action={
            <Link
              href={`/admin/clientes/${domainId}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ArrowLeft className="size-3.5" />
              {t('detail.backToClient')}
            </Link>
          }
        />
      )}

      {state.kind === 'error' && (
        <AdminEmptyState
          icon={AlertTriangle}
          title={t('detail.errorTitle')}
          description={t('detail.errorDescription')}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setState({ kind: 'loading' })
                void load()
              }}
            >
              <RotateCw className="size-3.5" />
              {t('detail.retry')}
            </Button>
          }
        />
      )}
    </div>
  )
}

function AppDetailReady({
  domainId,
  app,
  onReload,
}: {
  domainId: string
  app: PortalAppDetail
  onReload: () => void
}) {
  const { t } = useTranslation('admin/app-settings')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isThinkzap = app.appCodeId === THINKZAP_APP_CODE_ID
  const activeTab = resolveAppTab(searchParams.get(APP_TAB_PARAM), isThinkzap)
  const [techOpen, setTechOpen] = useState(isTechnicalTab(activeTab))

  /** A aba vive no endereço: recarregar ou compartilhar o link abre a mesma aba. */
  const selectTab = (tab: AppTab) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(APP_TAB_PARAM, tab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const toggleTechnical = () => {
    const next = !techOpen
    setTechOpen(next)
    // Fechar o grupo com uma aba técnica aberta deixaria a tela sem conteúdo.
    if (!next && isTechnicalTab(activeTab)) selectTab('visao-geral')
  }

  return (
    <div className="space-y-6">
      <AdminAppHeader domainId={domainId} app={app} />

      <Tabs
        value={activeTab}
        onValueChange={value => selectTab(value as AppTab)}
      >
        <TabsList
          aria-label={t('detail.tabsLabel')}
          className="max-w-full flex-wrap"
        >
          {[...GENERAL_TABS, ...(isThinkzap ? THINKZAP_TABS : [])].map(tab => (
            <TabsTrigger key={tab} value={tab}>
              {t(APP_TAB_LABEL_KEY[tab])}
            </TabsTrigger>
          ))}

          {isThinkzap && (
            <>
              <span
                aria-hidden
                className="mx-1 h-5 w-px self-center bg-border"
              />
              <button
                type="button"
                aria-expanded={techOpen}
                onClick={toggleTechnical}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <ChevronRight
                  aria-hidden
                  className={cn(
                    'size-3 transition-transform duration-200',
                    techOpen && 'rotate-90',
                  )}
                />
                {t('technicalTabsLabel')}
              </button>
              {techOpen &&
                TECHNICAL_TABS.map(tab => (
                  <TabsTrigger key={tab} value={tab}>
                    {t(APP_TAB_LABEL_KEY[tab])}
                  </TabsTrigger>
                ))}
            </>
          )}
        </TabsList>

        <TabsContent value="visao-geral" className="mt-4">
          <AdminAppOverviewSection
            app={app}
            onMirrorLinked={onReload}
            onOpenSubscriptions={() => selectTab('assinaturas')}
          />
        </TabsContent>

        <TabsContent value="assinaturas" className="mt-4">
          <AdminAppSubscriptionsSection appId={app.id} />
        </TabsContent>

        {isThinkzap && (
          <>
            <TabsContent value="linhas" className="mt-4">
              <AdminClientInstancesSection appId={app.id} />
            </TabsContent>
            <TabsContent value="implantacao" className="mt-4">
              <AdminClientDeploymentSection appId={app.id} />
            </TabsContent>
            <TabsContent value="placements" className="mt-4">
              <AdminClientPlacementsSection appId={app.id} />
            </TabsContent>
            <TabsContent value="robos" className="mt-4">
              <AdminClientBizprocRobotsSection appId={app.id} />
            </TabsContent>
            <TabsContent value="provedores-sms" className="mt-4">
              <AdminClientSmsSendersSection appId={app.id} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}

/** Breadcrumb, título e os dois estados que o suporte olha primeiro. */
export function AdminAppHeader({
  domainId,
  app,
}: {
  domainId: string
  app: PortalAppDetail
}) {
  const { t } = useTranslation('admin/app-settings')
  const { t: tStatus } = useTranslation(STATUS_NAMESPACE)
  const appStatus = statusMeta(APP_STATUS, app.status)
  const mirror = statusMeta(MIRROR_STATUS, app.mirror)

  return (
    <AdminPageHeader
      breadcrumb={[
        { label: t('detail.breadcrumb'), href: '/admin/clientes' },
        { label: app.domain.name, href: `/admin/clientes/${domainId}` },
        { label: app.title },
      ]}
      title={app.title}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs">{app.appCode}</span>
          <AdminStatusBadge tone={appStatus.tone}>
            {tStatus(appStatus.labelKey)}
          </AdminStatusBadge>
          <AdminStatusBadge tone={mirror.tone}>
            {tStatus(mirror.labelKey)}
          </AdminStatusBadge>
        </span>
      }
    />
  )
}
