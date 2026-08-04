'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TemplatesTab } from './templates-tab'

type OficialTab = 'templates'

type Props = {
  /** Id do item de assinatura — a linha oficial. */
  itemId: string
}

/**
 * Configurações da linha oficial (HubMessage / WhatsApp Oficial), organizadas em
 * abas. Nesta entrega a única aba disponível é Templates.
 *
 * Identificada pelo item de assinatura, como a linha do WhatsApp Web: o `wabaId` que
 * as operações de template precisam vive no `metadata` do item, então nem
 * `Connector` nem `Instance` participam.
 */
export function ConfiguracoesOficial({ itemId }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')
  const [activeTab, setActiveTab] = useState<OficialTab>('templates')

  return (
    <div className="w-full">
      <nav className="flex gap-1 border-b border-border">
        <button
          type="button"
          aria-current={activeTab === 'templates' ? 'page' : undefined}
          onClick={() => setActiveTab('templates')}
          className={`relative cursor-pointer rounded-t-lg px-4 py-2.5 text-sm transition-colors ${
            activeTab === 'templates'
              ? 'bg-card font-semibold text-primary'
              : 'font-medium text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          {t('tab')}
          {activeTab === 'templates' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </nav>

      <div className="rounded-b-lg rounded-tr-lg border border-t-0 border-border bg-card p-6">
        {activeTab === 'templates' && <TemplatesTab itemId={itemId} />}
      </div>
    </div>
  )
}
