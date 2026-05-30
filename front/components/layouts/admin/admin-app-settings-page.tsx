'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { AdminClientImbotSection } from './admin-client-imbot-section'
import { AdminClientPlacementsSection } from './admin-client-placements-section'

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

      <Tabs defaultValue="imbot">
        <TabsList>
          <TabsTrigger value="imbot">{t('tabs.imbot')}</TabsTrigger>
          <TabsTrigger value="placements">{t('tabs.placements')}</TabsTrigger>
        </TabsList>

        <TabsContent value="imbot" className="mt-4">
          <AdminClientImbotSection appId={appId} />
        </TabsContent>

        <TabsContent value="placements" className="mt-4">
          <AdminClientPlacementsSection appId={appId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
