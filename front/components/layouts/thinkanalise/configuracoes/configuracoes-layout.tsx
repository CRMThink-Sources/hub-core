'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import type {
  Connection,
  Dataset,
  Source,
} from '../../types/thinkanalise-types'
import { ConfigCard } from './configcard'
import { useSession } from '@/providers/session-provider'

type BitrixConnector = {
  id: number
  title: string
  provider?: string
}

export default function ConfiguracoesLayout() {
  const { session, refreshSession } = useSession()
  const refreshSessionRef = useRef(refreshSession)
  useEffect(() => {
    refreshSessionRef.current = refreshSession
  })

  const [newConnections, setNewConnections] = useState<Connection[]>([])
  const [oauthBanner, setOauthBanner] = useState<'success' | 'error' | null>(
    null,
  )

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (
        !event.data ||
        event.data.type !== 'conta-azul-oauth' ||
        (event.data.status !== 'success' && event.data.status !== 'error')
      )
        return
      setOauthBanner(event.data.status)
      if (event.data.status === 'success') {
        void refreshSessionRef.current()
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const savedConnections: Connection[] = useMemo(() => {
    const biconnectors = (session?.biconnectors ?? []) as BitrixConnector[]
    return biconnectors.map(c => ({
      id: String(c.id),
      label: c.title.replace('[ThinkAnalise] ', ''),
      provider: (c.provider ?? 'asaas') as Connection['provider'],
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
      {oauthBanner && (
        <div
          className={`w-full max-w-3xl px-4 py-3 rounded-lg text-sm font-mono flex items-center justify-between
            ${oauthBanner === 'success' ? 'bg-[#eef2f9] text-[#223f6e] border border-[#223f6e]/20' : 'bg-red-50 text-red-700 border border-red-200'}`}
        >
          <span>
            {oauthBanner === 'success'
              ? 'Conta Azul conectada com sucesso.'
              : 'Não foi possível conectar com a Conta Azul. Tente novamente.'}
          </span>
          <button
            onClick={() => setOauthBanner(null)}
            className="ml-4 text-xs opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

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
        {allConnections.length === 0 ? (
          <p className="text-sm text-gray-400 font-mono px-1">
            nenhuma conexão ainda.
          </p>
        ) : (
          allConnections.map(c => (
            <ConfigCard
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
