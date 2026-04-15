'use client'

import { useState } from 'react'
import HistoricoPagamentos from './historico-pagamentos-layout'
import GestaoLinhas from './gestao-linhas-layout'

type TabType = 'gestao' | 'historico'

export default function PagamentosLayout() {
  const [activeTab, setActiveTab] = useState<TabType>('gestao')

  return (
    <div className="relative mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="flex w-full items-center justify-between rounded-lg border border-gray-100 bg-white p-6">
        <div>
          <h1 className="page-title">Financeiro</h1>
        </div>
      </div>

      <div className="w-full">
        <div className="flex gap-1 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('gestao')}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg cursor-pointer
        ${
          activeTab === 'gestao'
            ? 'text-[#5A997E] bg-white'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }
      `}
          >
            Gestao de linhas
            {activeTab === 'gestao' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A997E]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('historico')}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg cursor-pointer
              ${
                activeTab === 'historico'
                  ? 'text-[#5A997E] bg-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }
            `}
          >
            Histórico de pagamentos
            {activeTab === 'historico' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A997E]" />
            )}
          </button>
        </div>

        <div className="bg-white rounded-b-lg rounded-tr-lg border border-gray-100 border-t-0 p-6">
          {activeTab === 'gestao' && <GestaoLinhas />}
          {activeTab === 'historico' && <HistoricoPagamentos />}
        </div>
      </div>
    </div>
  )
}
