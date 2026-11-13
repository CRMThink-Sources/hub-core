'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminInboundFailuresPanel } from './admin-inbound-failures-panel'
import { AdminOutboxFailuresPage } from './admin-outbox-failures-page'
import {
  FAILURES_DOMAIN_PARAM,
  FAILURES_TAB_PARAM,
  resolveFailureTab,
} from './failures-tab'

/**
 * `/admin/falhas-envio`: as falhas de envio e de recebimento do ThinkZap, em duas abas.
 * "Envio" é a tela que já existia; "Recebimento" são os eventos recebidos que esgotaram
 * as tentativas. Cada aba só carrega quando é aberta.
 */
export function AdminFailuresPage() {
  const { t } = useTranslation('admin/message-failures')
  const searchParams = useSearchParams()
  const initialTab = resolveFailureTab(searchParams.get(FAILURES_TAB_PARAM))
  const initialDomain = searchParams.get(FAILURES_DOMAIN_PARAM) ?? ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          {t('description')}
        </p>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList aria-label={t('tabs.label')}>
          <TabsTrigger value="outbox">{t('tabs.outbox')}</TabsTrigger>
          <TabsTrigger value="inbound">{t('tabs.inbound')}</TabsTrigger>
        </TabsList>

        <TabsContent value="outbox" className="pt-4">
          <AdminOutboxFailuresPage embedded initialDomain={initialDomain} />
        </TabsContent>
        <TabsContent value="inbound" className="pt-4">
          <AdminInboundFailuresPanel initialDomain={initialDomain} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
