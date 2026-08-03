'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { AdminClientDeploymentSection } from './admin-client-deployment-section'
import { AdminClientPlacementsSection } from './admin-client-placements-section'
import { AdminClientBizprocRobotsSection } from './admin-client-bizproc-robots-section'
import { AdminClientInstancesSection } from './admin-client-instances-section'

const TECH_TABS = ['deployment', 'placements', 'bizproc'] as const
type TabValue = 'instances' | (typeof TECH_TABS)[number]

type Props = {
  domainId: string
  appId: string
}

export function AdminAppSettingsPage({ domainId, appId }: Props) {
  const { t } = useTranslation('admin/app-settings')
  const [activeTab, setActiveTab] = useState<TabValue>('instances')
  const [techOpen, setTechOpen] = useState(false)

  function handleTechToggle() {
    setTechOpen(prev => {
      const next = !prev
      if (!next && (TECH_TABS as readonly string[]).includes(activeTab)) {
        setActiveTab('instances')
      }
      return next
    })
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/clientes/${domainId}`}
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
        <p className="mt-2 text-muted-foreground">{t('description')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="instances">{t('tabs.instances')}</TabsTrigger>
          {/* A aba de assinaturas saiu com a cobrança antiga: lia
              `/apps/:appId/subscriptions`, que foi removida junto. */}
          <span className="mx-1 h-5 w-px self-center bg-border" />
          <button
            type="button"
            onClick={handleTechToggle}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <ChevronRight
              className={cn(
                'size-3 transition-transform duration-200',
                techOpen && 'rotate-90',
              )}
            />
            {t('technicalTabsLabel')}
          </button>
          {techOpen ? (
            <>
              <span className="mx-1 h-5 w-px self-center bg-border" />
              <TabsTrigger value="deployment">
                {t('tabs.deployment')}
              </TabsTrigger>
              <TabsTrigger value="placements">
                {t('tabs.placements')}
              </TabsTrigger>
              <TabsTrigger value="bizproc">{t('tabs.bizproc')}</TabsTrigger>
            </>
          ) : null}
        </TabsList>

        <TabsContent value="instances" className="mt-4">
          <AdminClientInstancesSection appId={appId} />
        </TabsContent>

        <TabsContent value="deployment" className="mt-4">
          <AdminClientDeploymentSection appId={appId} />
        </TabsContent>

        <TabsContent value="placements" className="mt-4">
          <AdminClientPlacementsSection appId={appId} />
        </TabsContent>

        <TabsContent value="bizproc" className="mt-4">
          <AdminClientBizprocRobotsSection appId={appId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
