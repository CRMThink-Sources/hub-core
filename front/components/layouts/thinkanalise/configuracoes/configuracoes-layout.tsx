'use client'

import { useState } from 'react'
import type { Config } from '../../types/thinkanalise-types'
import { ConfigCard } from './configcard'

export default function ConfiguracoesLayout() {
  const [configs, setConfigs] = useState<Config[]>([])

  function addConfig() {
    const nova: Config = {
      id: crypto.randomUUID(),
      provider: 'asaas',
      label: '',
      apiKey: '',
      syncFreq: 60,
      status: 'pendente',
    }
    console.log('[nova config] criada →', nova)
    setConfigs(prev => [...prev, nova])
  }

  function updateConfig(updated: Config) {
    setConfigs(prev => prev.map(c => (c.id === updated.id ? updated : c)))
  }

  return (
    <div className="w-full flex flex-col pt-20 px-6 space-y-4">
      {/* header */}
      <div className="flex items-center justify-between w-full max-w-3xl bg-white p-6 rounded-xl border border-[#e5e7eb]">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Configurações</h1>
          <h2 className="text-sm text-gray-400 mt-1">
            Crie e gerencie as conexões de API
          </h2>
        </div>
        <button
          onClick={addConfig}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border border-[#e5e7eb] bg-white
                     hover:bg-[#f3e8ff] hover:border-[#6c02ad] hover:text-[#6c02ad] transition-all cursor-pointer"
        >
          <span className="w-4 h-4 rounded-full bg-[#6c02ad] text-white flex items-center justify-center text-xs leading-none">
            +
          </span>
          nova configuração
        </button>
      </div>

      {/* lista */}
      <div className="w-full max-w-3xl flex flex-col gap-4">
        {configs.length === 0 ? (
          <p className="text-sm text-gray-400 font-mono px-1">
            nenhuma configuração ainda.
          </p>
        ) : (
          configs.map(c => (
            <ConfigCard key={c.id} config={c} onChange={updateConfig} />
          ))
        )}
      </div>
    </div>
  )
}
