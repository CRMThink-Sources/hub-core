'use client'

import { useState } from 'react'
import type { Connection } from '../../types/thinkanalise-types'
import { ConfigCard } from './configcard'

export default function ConfiguracoesLayout() {
  const [connections, setConnections] = useState<Connection[]>([])

  function addConnection() {
    const nova: Connection = {
      id: crypto.randomUUID(),
      provider: 'asaas',
      label: '',
      apiKey: '',
      status: 'pendente',
    }
    setConnections(prev => [...prev, nova])
  }

  function updateConnection(updated: Connection) {
    setConnections(prev => prev.map(c => (c.id === updated.id ? updated : c)))
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
          onClick={addConnection}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border border-[#e5e7eb] bg-white
                     hover:bg-[#eef2f9] hover:border-[#223f6e] hover:text-[#223f6e] transition-all cursor-pointer"
        >
          <span className="w-4 h-4 rounded-full bg-[#223f6e] text-white flex items-center justify-center text-xs leading-none">
            +
          </span>
          nova conexão
        </button>
      </div>

      {/* lista */}
      <div className="w-full max-w-3xl flex flex-col gap-4">
        {connections.length === 0 ? (
          <p className="text-sm text-gray-400 font-mono px-1">
            nenhuma conexão ainda.
          </p>
        ) : (
          connections.map(c => (
            <ConfigCard key={c.id} connection={c} onChange={updateConnection} />
          ))
        )}
      </div>
    </div>
  )
}
