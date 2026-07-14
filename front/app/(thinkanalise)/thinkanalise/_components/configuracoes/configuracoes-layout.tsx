'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { ChevronDownIcon, PlusIcon, XIcon } from 'lucide-react'
import type { Connection } from '../types'
import { ConnectorCard } from './connector/connector-card'
import { OAUTH_MESSAGE_TYPES, PROVIDERS } from './constants'
import { useSession } from '@/providers/session-provider'
import { LoadingProvider } from '@/providers/loading-provider'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
        !OAUTH_MESSAGE_TYPES.includes(event.data.type) ||
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

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-8 sm:px-6 lg:px-8">
        {oauthBanner && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              'flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm',
              oauthBanner === 'success'
                ? 'border-border bg-accent text-accent-foreground'
                : 'border-destructive/20 bg-destructive/10 text-destructive',
            )}
          >
            <span>
              {oauthBanner === 'success' ? t('oauth.sucesso') : t('oauth.erro')}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setOauthBanner(null)}
              aria-label="Fechar aviso"
            >
              <XIcon />
            </Button>
          </div>
        )}

        {/* header */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t('title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('subtitle')}
            </p>
          </div>
          <Button onClick={addConnection}>
            <PlusIcon />
            {t('novaConexao')}
          </Button>
        </div>

        {/* lista */}
        <div className="flex flex-col gap-6">
          {!hasAny && (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <p className="text-sm text-muted-foreground">
                {t('nenhumaConexao')}
              </p>
            </div>
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
                  className="group flex w-full cursor-pointer items-center gap-3"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground transition-colors group-hover:text-primary">
                    {p.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground/60">
                    {groupedSaved[p.value].length}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                  <ChevronDownIcon
                    className={cn(
                      'size-4 text-muted-foreground/60 transition-all group-hover:text-primary',
                      isCollapsed && '-rotate-90',
                    )}
                  />
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
