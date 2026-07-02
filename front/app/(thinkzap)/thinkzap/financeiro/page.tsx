'use client'

import GestaoLinhas from '@/app/(thinkzap)/thinkzap/_layout/gestao-linhas-layout'
import HistoricoPagamentos from '@/app/(thinkzap)/thinkzap/_layout/historico-pagamentos-layout'
import { useState } from 'react'
import { useSession } from '@/providers/session-provider'
import { useTranslation } from 'react-i18next'

type TabType = 'gestao' | 'historico'

export default function PagamentosPage() {
  const { session } = useSession()
  const [activeTab, setActiveTab] = useState<TabType>('gestao')
  const { t } = useTranslation('thinkzap/financeiro')

  return (
    <div className="relative mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {t('pageTitle')}
          </h1>
        </div>
      </div>

      <div className="w-full">
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab('gestao')}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg cursor-pointer
        ${
          activeTab === 'gestao'
            ? 'text-primary bg-card'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }
      `}
          >
            {t('tabs.gestao')}
            {activeTab === 'gestao' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          {/* <button
            onClick={() => setActiveTab('historico')}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg cursor-pointer
              ${
                activeTab === 'historico'
                  ? 'text-primary bg-card'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }
            `}
          >
            Histórico de pagamentos
            {activeTab === 'historico' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button> */}
        </div>

        <div className="bg-card rounded-b-lg rounded-tr-lg border border-border border-t-0 p-6">
          {activeTab === 'gestao' && <GestaoLinhas />}
          {/* {activeTab === 'historico' && <HistoricoPagamentos />} */}
        </div>
      </div>
    </div>
  )
}
