'use client'

import { useState, useEffect } from 'react'
import { PROVIDERS } from '../constants'
import { useSession } from '@/providers/session-provider'
import type { Connection, Source } from '../../../types/thinkanalise-types'
import { axiosThinkanalise } from '@/infra/client/axios-thinkanalise'
import { SourceCard, NewSourceCard } from '../source/source-card'
import { toast } from 'sonner'
import { useLoading } from '@/providers/loading-provider'
import { useTranslation } from 'react-i18next'

const PROVIDER_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  asaas: {
    bg: 'bg-[#dbeafe]',
    text: 'text-[#1e40af]',
    border: 'border-[#93c5fd]',
  },
  conta_azul: {
    bg: 'bg-[#e0f2fe]',
    text: 'text-[#0369a1]',
    border: 'border-[#bae6fd]',
  },
  omie: {
    bg: 'bg-[#fff7ed]',
    text: 'text-[#c2410c]',
    border: 'border-[#fed7aa]',
  },
  sonax: {
    bg: 'bg-[#ecfeff]',
    text: 'text-[#0891b2]',
    border: 'border-[#a5f3fc]',
  },
}

type Props = {
  connection: Connection
  onChange: (updated: Connection) => void
  onSaved: (id: string) => Promise<void>
  onDeleted: () => Promise<void>
  onRemoveNew: (id: string) => void
  isOpen?: boolean
  onToggle?: () => void
}

export function ConnectorCard({
  connection,
  onChange,
  onSaved,
  onDeleted,
  onRemoveNew,
  isOpen,
  onToggle,
}: Props) {
  const { session } = useSession()
  const { t } = useTranslation('thinkanalise/configuracoes/connector')
  const BLOCKED_DOMAIN_ID = '9c8d9dca-db2d-4978-93ca-fc28ba6017d7' // domainId do cliente https://bmd.bitrix24.com.br/
  const isBlocked = session?.app?.domainId === BLOCKED_DOMAIN_ID // bloquando para o cliente apenas usar connectores asaas
  const availableProviders = isBlocked
    ? PROVIDERS.filter(p => p.value === 'asaas')
    : PROVIDERS

  const isSaved = !!connection.biconnectorId

  const [draft, setDraft] = useState({ label: connection.label })
  const [isEditing, setIsEditing] = useState(false)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [internalExpanded, setInternalExpanded] = useState(!isSaved)
  const expanded = isOpen !== undefined ? isOpen : internalExpanded
  function toggleExpanded() {
    if (onToggle) onToggle()
    else setInternalExpanded(prev => !prev)
  }
  const [addingSource, setAddingSource] = useState(false)
  const [sources, setSources] = useState<Source[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(false)

  const { setLoading } = useLoading()

  async function fetchSources() {
    if (!connection.biconnectorId) return
    setSourcesLoading(true)
    try {
      const client = axiosThinkanalise()
      const data = (await client.get(
        `/thinkanalise/connector/${connection.biconnectorId}/sources`,
      )) as unknown as Source[]
      setSources(data)
    } finally {
      setSourcesLoading(false)
    }
  }

  useEffect(() => {
    if (!expanded || !isSaved || !connection.biconnectorId) return
    const controller = new AbortController()
    setSourcesLoading(true)
    axiosThinkanalise()
      .get(`/thinkanalise/connector/${connection.biconnectorId}/sources`, {
        signal: controller.signal,
      })
      .then(data => setSources(data as unknown as Source[]))
      .catch(() => {})
      .finally(() => setSourcesLoading(false))
    return () => controller.abort()
  }, [expanded, isSaved])

  function updateNew(patch: Partial<Connection>) {
    onChange({ ...connection, ...patch })
  }

  function handleCancelEdit() {
    setDraft({ label: connection.label })
    setIsEditing(false)
  }

  const currentLabel =
    isSaved && !isEditing
      ? connection.label
      : isSaved
        ? draft.label
        : connection.label
  const isReadOnly = isSaved && !isEditing

  async function handleSave() {
    setSaving(true)
    setLoading(true, t('loading.salvando'))
    try {
      const client = axiosThinkanalise()
      if (isSaved) {
        await client.put(
          `/thinkanalise/connector/${connection.biconnectorId}`,
          {
            label: draft.label,
          },
        )
        await onSaved(connection.id)
        toast.success(t('toast.atualizado'))
      } else {
        if (!connection.label) return
        await client.post('/thinkanalise/connector', {
          label: connection.label,
          provider: connection.provider,
        })
        await onSaved(connection.id)
        toast.success(t('toast.criado'))
      }
    } catch {
      toast.error(t('toast.erroSalvar'))
      if (!isSaved) onChange({ ...connection, status: 'erro' })
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!isSaved) {
      onRemoveNew(connection.id)
      return
    }
    setDeleting(true)
    setLoading(true, t('loading.removendo'))
    try {
      const client = axiosThinkanalise()
      await client.delete(`/thinkanalise/connector/${connection.biconnectorId}`)
      await onDeleted()
      toast.success(t('toast.removido'))
    } catch {
      await onDeleted()
    } finally {
      setDeleting(false)
      setLoading(false)
    }
  }

  const statusColor = {
    conectado: 'bg-[#4a7fd4]',
    pendente: 'bg-yellow-400',
    erro: 'bg-red-400',
  }[connection.status]

  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
      {/* cabeçalho */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b border-[#e5e7eb] bg-[#F9F9FB] cursor-pointer select-none"
        onClick={toggleExpanded}
      >
        {(() => {
          const colors =
            PROVIDER_COLORS[connection.provider] ?? PROVIDER_COLORS['asaas']
          return (
            <span
              className={`text-[11px] font-mono font-medium px-2.5 py-0.5 rounded border tracking-wide uppercase ${colors.bg} ${colors.text} ${colors.border}`}
            >
              {PROVIDERS.find(p => p.value === connection.provider)?.label ??
                connection.provider}
            </span>
          )
        })()}

        <span className="text-sm font-semibold">
          {currentLabel || (
            <span className="text-gray-300 font-normal">{t('semNome')}</span>
          )}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-xs text-gray-400 font-mono">
            {t(`statusLabel.${connection.status}`)}
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className={`ml-1 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <path
              d="M3 5l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {expanded && (
        <>
          <div className="px-5 py-5 flex flex-col gap-5">
            {/* label — só para novos */}
            {!isSaved && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
                  {t('campos.nome')}
                </label>
                <input
                  type="text"
                  value={connection.label}
                  onChange={e => updateNew({ label: e.target.value })}
                  placeholder={t('campos.nomeConexao')}
                  className="w-full font-mono text-sm px-3 py-2.5 rounded-lg border border-[#e5e7eb] bg-[#F9F9FB] text-black outline-none
                             focus:border-[#223f6e] focus:ring-2 focus:ring-[#223f6e]/20 focus:bg-white
                             hover:border-[#223f6e] transition-colors"
                />
              </div>
            )}

            {/* label — edição de conector salvo */}
            {isSaved && isEditing && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
                  {t('campos.nome')}
                </label>
                <input
                  type="text"
                  value={draft.label}
                  onChange={e =>
                    setDraft(d => ({ ...d, label: e.target.value }))
                  }
                  className="w-full font-mono text-sm px-3 py-2.5 rounded-lg border border-[#e5e7eb] bg-[#F9F9FB] text-black outline-none
                             focus:border-[#223f6e] focus:ring-2 focus:ring-[#223f6e]/20 focus:bg-white
                             hover:border-[#223f6e] transition-colors"
                />
              </div>
            )}

            {/* integração */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
                {t('campos.integracao')}
              </label>
              <select
                value={connection.provider}
                onChange={e =>
                  updateNew({
                    provider: e.target.value as Connection['provider'],
                  })
                }
                disabled={isReadOnly || isSaved}
                className="w-full font-mono text-sm px-3 py-2.5 rounded-lg border border-[#e5e7eb] bg-[#F9F9FB] text-black outline-none
                           focus:border-[#223f6e] focus:ring-2 focus:ring-[#223f6e]/20 focus:bg-white
                           hover:border-[#223f6e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {availableProviders.map(p => (
                  <option key={p.value} value={p.value} disabled={p.disabled}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* seção de fontes — só para conectores salvos */}
          {isSaved && (
            <div className="px-5 pb-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
                  {t('fontes')} ({sources.length})
                </span>
                {!addingSource && (
                  <button
                    onClick={() => setAddingSource(true)}
                    className="flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-lg border border-[#e5e7eb] text-gray-400
                               hover:bg-[#eef2f9] hover:text-[#223f6e] hover:border-[#223f6e] transition-all cursor-pointer"
                  >
                    <span className="text-base leading-none">+</span>
                    {t('novaFonte')}
                  </button>
                )}
              </div>

              {sourcesLoading && (
                <p className="text-xs font-mono text-gray-400 px-1">
                  {t('carregando')}
                </p>
              )}
              {sources.map(s => (
                <SourceCard
                  key={s.id}
                  source={s}
                  connectorId={connection.biconnectorId!}
                  provider={connection.provider}
                  onSaved={fetchSources}
                  onDeleted={fetchSources}
                />
              ))}

              {addingSource && (
                <NewSourceCard
                  connectorId={connection.biconnectorId!}
                  provider={connection.provider}
                  onSaved={async () => {
                    setAddingSource(false)
                    await fetchSources()
                  }}
                  onCancel={() => setAddingSource(false)}
                />
              )}
            </div>
          )}

          {/* rodapé */}
          <div className="flex items-center justify-end px-5 py-4 border-t border-[#e5e7eb] gap-2">
            <button
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="text-xs font-mono px-3.5 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400
                         hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-50 cursor-pointer"
            >
              {deleting ? t('acoes.removendo') : t('acoes.remover')}
            </button>

            {isSaved && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm font-semibold px-5 py-2 rounded-lg border border-[#223f6e] text-[#223f6e] hover:bg-[#eef2f9] transition-colors cursor-pointer"
              >
                {t('acoes.editar')}
              </button>
            )}

            {isSaved && isEditing && (
              <>
                <button
                  onClick={handleCancelEdit}
                  className="text-xs font-mono px-3.5 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400
                             hover:bg-gray-50 transition-all cursor-pointer"
                >
                  {t('acoes.cancelar')}
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving || !draft.label}
                  className="text-sm font-semibold px-5 py-2 rounded-lg bg-[#223f6e] text-white hover:bg-[#1a3058] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {saving ? t('acoes.salvando') : t('acoes.salvar')}
                </button>
              </>
            )}

            {!isSaved && (
              <button
                onClick={() => void handleSave()}
                disabled={saving || !connection.label}
                className="text-sm font-semibold px-5 py-2 rounded-lg bg-[#223f6e] text-white hover:bg-[#1a3058] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? t('acoes.salvando') : t('acoes.salvar')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
