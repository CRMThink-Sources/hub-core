'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TemplatesTab } from './templates-tab'

type OficialTab = 'templates'

type Connector = {
  id: string
  instance?: { name?: string | null }
}

type Props = {
  connector: Connector
  authTokenKey: string
}

/**
 * Configurações do conector oficial (HubMessage / WhatsApp Oficial), organizadas
 * em abas. Nesta entrega a única aba disponível é Templates.
 */
export function ConfiguracoesOficial({ connector, authTokenKey }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')
  const [activeTab, setActiveTab] = useState<OficialTab>('templates')

  return (
    <div className="w-full">
      <div className="flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`relative cursor-pointer rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'templates'
              ? 'bg-card text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          {t('tab')}
          {activeTab === 'templates' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      <div className="rounded-b-lg rounded-tr-lg border border-t-0 border-border bg-card p-6">
        {activeTab === 'templates' && (
          <TemplatesTab
            connectorId={connector.id}
            authTokenKey={authTokenKey}
          />
        )}
      </div>
    </div>
  )
}
