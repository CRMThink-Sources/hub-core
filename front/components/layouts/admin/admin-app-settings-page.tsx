'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { AdminClientDeploymentSection } from './admin-client-deployment-section'
import { AdminClientPlacementsSection } from './admin-client-placements-section'
import { AdminClientBizprocRobotsSection } from './admin-client-bizproc-robots-section'
import { AdminClientThinkzapConnectorsSection } from './admin-client-thinkzap-connectors-section'

type Props = {
  domainId: string
  appId: string
}

export function AdminAppSettingsPage({ domainId, appId }: Props) {
  const { t } = useTranslation('admin/app-settings')

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

      <Tabs defaultValue="deployment">
        <TabsList>
          <TabsTrigger value="deployment">{t('tabs.deployment')}</TabsTrigger>
          <TabsTrigger value="placements">{t('tabs.placements')}</TabsTrigger>
          <TabsTrigger value="bizproc">{t('tabs.bizproc')}</TabsTrigger>
          <TabsTrigger value="connectors">{t('tabs.connectors')}</TabsTrigger>
        </TabsList>

        <TabsContent value="deployment" className="mt-4">
          <AdminClientDeploymentSection appId={appId} />
        </TabsContent>

        <TabsContent value="placements" className="mt-4">
          <AdminClientPlacementsSection appId={appId} />
        </TabsContent>

        <TabsContent value="bizproc" className="mt-4">
          <AdminClientBizprocRobotsSection appId={appId} />
        </TabsContent>

        <TabsContent value="connectors" className="mt-4">
          <AdminClientThinkzapConnectorsSection appId={appId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
