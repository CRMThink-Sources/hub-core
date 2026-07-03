'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useSession } from '@/providers/session-provider'
import { envConfig } from '@/shared/infra/env-config'
import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { GeralTab } from '../../../_components/configuracoes/geral-tab'
import { GruposTab } from '../../../_components/configuracoes/grupos-tab'

type TabType = 'geral' | 'grupos'

export default function ConfiguracoesConectorPage() {
  const params = useParams()
  const connectorId = params.connectorId as string
  const { session, refreshSession } = useSession()
  const { t } = useTranslation('thinkzap/configuracoes/page')
  const [activeTab, setActiveTab] = useState<TabType>('geral')

  const authTokenKey = getAppRedirectUrl(
    envConfig.appCodes.thinkzap,
  )?.storageAuthTokenKey

  const connector = session?.connectors?.find(
    (c: { id: string }) => c.id === connectorId,
  )

  if (!connector) {
    return (
      <div className="relative mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 pb-10 pt-8 sm:px-6 lg:px-8">
        <p className="text-muted-foreground">{t('conectorNaoEncontrado')}</p>
        <Link
          href="/thinkzap/conexoes"
          className="text-sm text-primary hover:underline"
        >
          {t('voltar')}
        </Link>
      </div>
    )
  }

  const isConnected = connector.instance?.connected === true

  return (
    <div className="relative mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2">
        <Link
          href="/thinkzap/conexoes"
          className="w-fit text-sm text-primary hover:underline"
        >
          ← {t('voltar')}
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {t('pageTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {connector.instance?.name || connector.id}
        </p>
      </div>

      <div className="w-full">
        <div className="flex gap-1 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('geral')}
            className={`relative cursor-pointer rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'geral'
                ? 'bg-card text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {t('tabs.geral')}
            {activeTab === 'geral' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('grupos')}
            className={`relative cursor-pointer rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'grupos'
                ? 'bg-card text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {t('tabs.grupos')}
            {activeTab === 'grupos' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        <div className="rounded-b-lg rounded-tr-lg border border-t-0 border-border bg-card p-6">
          {activeTab === 'geral' && authTokenKey && (
            <GeralTab
              connector={connector}
              authTokenKey={authTokenKey}
              onSaved={() => void refreshSession()}
            />
          )}
          {activeTab === 'grupos' && authTokenKey && (
            <GruposTab
              connectorId={connector.id}
              isConnected={isConnected}
              authTokenKey={authTokenKey}
            />
          )}
        </div>
      </div>
    </div>
  )
}
