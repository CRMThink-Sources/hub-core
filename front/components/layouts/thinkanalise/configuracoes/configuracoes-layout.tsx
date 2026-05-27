'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import type { Connection } from '../../types/thinkanalise-types'
import { ConnectorCard } from './connector/connector-card'
import { PROVIDERS } from './constants'
import { useSession } from '@/providers/session-provider'
import { LoadingProvider } from '@/providers/loading-provider'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { useTranslation } from 'react-i18next'

type BitrixConnector = {
  id: number
  title: string
  provider?: string
}

export default function ConfiguracoesLayout() {
  const { session, refreshSession } = useSession()
  const { t } = useTranslation('thinkanalise/configuracoes/page')
  const refreshSessionRef = useRef(refreshSession)
  useEffect(() => {
    refreshSessionRef.current = refreshSession
  })

  const [newConnections, setNewConnections] = useState<Connection[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [collapsedProviders, setCollapsedProviders] = useState<Set<string>>(
    new Set(),
  )
  const initializedProviders = useRef(false)

  function toggleProvider(provider: string) {
    setCollapsedProviders(prev => {
      const next = new Set(prev)
      if (next.has(provider)) next.delete(provider)
      else next.add(provider)
      return next
    })
  }
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
      label: c.title.replace('[Think Hub] ', ''),
      provider: (c.provider ?? 'asaas') as Connection['provider'],
      status: 'conectado' as const,
      biconnectorId: c.id,
    }))
  }, [session])

  useEffect(() => {
    if (initializedProviders.current || savedConnections.length === 0) return
    initializedProviders.current = true
    const toCollapse = new Set<string>()
    for (const [provider, conns] of Object.entries(
      savedConnections.reduce<Record<string, number>>((acc, c) => {
        acc[c.provider] = (acc[c.provider] ?? 0) + 1
        return acc
      }, {}),
    )) {
      if (conns > 5) toCollapse.add(provider)
    }
    if (toCollapse.size > 0) setCollapsedProviders(toCollapse)
  }, [savedConnections])

  function addConnection() {
    const newId = crypto.randomUUID()
    setNewConnections(prev => [
      {
        id: newId,
        provider: 'asaas' as const,
        label: '',
        status: 'pendente' as const,
      },
      ...prev,
    ])
    setExpandedId(newId)
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

  const groupedSaved = useMemo(() => {
    const groups: Record<string, Connection[]> = {}
    for (const c of savedConnections) {
      if (!groups[c.provider]) groups[c.provider] = []
      groups[c.provider].push(c)
    }
    return groups
  }, [savedConnections])

  function renderCard(c: Connection) {
    return (
      <ConnectorCard
        key={c.id}
        connection={c}
        onChange={updateNewConnection}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
        onRemoveNew={removeNewConnection}
        isOpen={expandedId === c.id}
        onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
      />
    )
  }

  const hasAny = savedConnections.length > 0 || newConnections.length > 0

  return (
    <LoadingProvider>
      <LoadingOverlay />

      <div className="w-full flex flex-col pt-20 px-6 space-y-4">
        {oauthBanner && (
          <div
            className={`w-full max-w-3xl px-4 py-3 rounded-lg text-sm font-mono flex items-center justify-between
            ${oauthBanner === 'success' ? 'bg-[#eef2f9] text-[#223f6e] border border-[#223f6e]/20' : 'bg-red-50 text-red-700 border border-red-200'}`}
          >
            <span>
              {oauthBanner === 'success' ? t('oauth.sucesso') : t('oauth.erro')}
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
        <div className="flex items-center justify-between w-full max-w-3xl mx-auto bg-white p-6 rounded-xl border border-[#e5e7eb]">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
            <h2 className="text-sm text-gray-400 mt-1">{t('subtitle')}</h2>
          </div>
          <button
            onClick={addConnection}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border border-[#e5e7eb] bg-white
                     hover:bg-[#eef2f9] hover:border-[#223f6e] hover:text-[#223f6e] transition-all cursor-pointer"
          >
            <span className="w-4 h-4 rounded-full bg-[#223f6e] text-white flex items-center justify-center text-xs leading-none">
              +
            </span>
            {t('novaConexao')}
          </button>
        </div>

        {/* lista */}
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
          {!hasAny && (
            <p className="text-sm text-gray-400 font-mono px-1">
              {t('nenhumaConexao')}
            </p>
          )}

          {/* novos conectores no topo */}
          {newConnections.length > 0 && (
            <div className="flex flex-col gap-2">
              {newConnections.map(c => renderCard(c))}
            </div>
          )}

          {/* conectores salvos agrupados por provider */}
          {PROVIDERS.filter(p => groupedSaved[p.value]?.length).map(p => {
            const isCollapsed = collapsedProviders.has(p.value)
            return (
              <div key={p.value} className="flex flex-col gap-2">
                <button
                  onClick={() => toggleProvider(p.value)}
                  className="flex items-center gap-3 w-full group cursor-pointer"
                >
                  <span className="text-[11px] font-mono font-semibold text-gray-400 uppercase tracking-widest group-hover:text-[#223f6e] transition-colors">
                    {p.label}
                  </span>
                  <span className="text-[11px] font-mono text-gray-300">
                    {groupedSaved[p.value].length}
                  </span>
                  <div className="flex-1 h-px bg-[#e5e7eb]" />
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    className={`text-gray-300 group-hover:text-[#223f6e] transition-all ${isCollapsed ? '-rotate-90' : ''}`}
                  >
                    <path
                      d="M2 4l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {!isCollapsed && (
                  <div className="flex flex-col gap-2">
                    {groupedSaved[p.value].map(c => renderCard(c))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </LoadingProvider>
  )
}
