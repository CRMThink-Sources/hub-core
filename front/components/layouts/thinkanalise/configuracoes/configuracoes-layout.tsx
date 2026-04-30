'use client'

import { useState, useMemo } from 'react'
import type {
  Connection,
  Dataset,
  Source,
} from '../../types/thinkanalise-types'
import { ConnectorCard } from './connector/connector-card'
import { useSession } from '@/providers/session-provider'

type BitrixConnector = {
  id: number
  title: string
}

export default function ConfiguracoesLayout() {
  const { session, refreshSession } = useSession()
  const [newConnections, setNewConnections] = useState<Connection[]>([])

  const savedConnections: Connection[] = useMemo(() => {
    const biconnectors = (session?.biconnectors ?? []) as BitrixConnector[]
    return biconnectors.map(c => ({
      id: String(c.id),
      label: c.title.replace('[ThinkAnalise] ', ''),
      provider: 'asaas' as const,
      status: 'conectado' as const,
      biconnectorId: c.id,
    }))
  }, [session])

  const sources = useMemo<Source[]>(() => {
    return (session?.sources ?? []) as Source[]
  }, [session])

  const datasets = useMemo<Dataset[]>(() => {
    return (session?.datasets ?? []) as Dataset[]
  }, [session])

  function addConnection() {
    setNewConnections(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        provider: 'asaas' as const,
        label: '',
        status: 'pendente' as const,
      },
    ])
  }

  function updateNewConnection(updated: Connection) {
    setNewConnections(prev =>
      prev.map(c => (c.id === updated.id ? updated : c)),
    )
  }

  function removeNewConnection(id: string) {
    setNewConnections(prev => prev.filter(c => c.id !== id))
  }

  async function handleSaved(id: string) {
    setNewConnections(prev => prev.filter(c => c.id !== id))
    await refreshSession()
  }

  async function handleDeleted() {
    await refreshSession()
  }

  const allConnections = [...savedConnections, ...newConnections]

  return (
    <div className="w-full flex flex-col pt-20 px-6 space-y-4">
      {/* header */}
      <div className="flex items-center justify-between w-full max-w-3xl mx-auto bg-white p-6 rounded-xl border border-[#e5e7eb]">
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
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-4">
        {allConnections.length === 0 ? (
          <p className="text-sm text-gray-400 font-mono px-1">
            nenhuma conexão ainda.
          </p>
        ) : (
          allConnections.map(c => (
            <ConnectorCard
              key={c.id}
              connection={c}
              onChange={updateNewConnection}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
              onRemoveNew={removeNewConnection}
              sources={sources.filter(s => s.connectorId === c.biconnectorId)}
              onSourcesChanged={refreshSession}
              datasets={datasets}
              onDatasetsChanged={refreshSession}
            />
          ))
        )}
      </div>
    </div>
  )
}
