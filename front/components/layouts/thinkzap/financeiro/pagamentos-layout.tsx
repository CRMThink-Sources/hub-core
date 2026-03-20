/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
'use client'

import { useState } from 'react'
import HistoricoPagamentos from './historico-pagamentos-layout'
import GestaoLinhas from './gestao-linhas-layout'

type TabType = 'gestao' | 'historico'

export default function PagamentosLayout() {
  const [activeTab, setActiveTab] = useState<TabType>('gestao')

  return (
    <div className="w-full flex flex-col pt-20 px-6 space-y-6 ">
      <div className="flex items-center justify-between w-full max-w-5xl bg-white p-6 rounded-lg border border-gray-100">
        <div>
          <h1 className="page-title">Financeiro</h1>
        </div>
      </div>

      <div className="w-full max-w-5xl">
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
