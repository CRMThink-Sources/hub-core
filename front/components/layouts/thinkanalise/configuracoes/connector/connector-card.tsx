'use client'

import { useState } from 'react'
import { PROVIDERS } from '../constants'
import { useSession } from '@/providers/session-provider'
import type {
  Connection,
  Dataset,
  Source,
} from '../../../types/thinkanalise-types'
import { axiosThinkanalise } from '@/infra/client/axios-thinkanalise'
import { SourceCard, NewSourceCard } from '../source/source-card'
import { toast } from 'sonner'

const PROVIDER_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  asaas: {
    bg: 'bg-[#e8eef7]',
    text: 'text-[#223f6e]',
    border: 'border-[#e5e7eb]',
  },
  conta_azul: {
    bg: 'bg-[#e8eef7]',
    text: 'text-[#223f6e]',
    border: 'border-[#e5e7eb]',
  },
  omie: {
    bg: 'bg-[#e8eef7]',
    text: 'text-[#223f6e]',
    border: 'border-[#e5e7eb]',
  },
}

type Props = {
  connection: Connection
  onChange: (updated: Connection) => void
  onSaved: (id: string) => Promise<void>
  onDeleted: () => Promise<void>
  onRemoveNew: (id: string) => void
  sources?: Source[]
  onSourcesChanged?: () => Promise<void>
  datasets?: Dataset[]
  onDatasetsChanged?: () => Promise<void>
  isOpen?: boolean
  onToggle?: () => void
}

export function ConnectorCard({
  connection,
  onChange,
  onSaved,
  onDeleted,
  onRemoveNew,
  sources = [],
  onSourcesChanged,
  datasets = [],
  onDatasetsChanged,
}: Props) {
  const { session } = useSession()
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
  const [expanded, setExpanded] = useState(!isSaved)
  const [addingSource, setAddingSource] = useState(false)

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
        toast.success('Conector atualizado com sucesso.')
      } else {
        if (!connection.label) return
        await client.post('/thinkanalise/connector', {
          label: connection.label,
          provider: connection.provider,
        })
        await onSaved(connection.id)
        toast.success('Conector criado com sucesso.')
      }
    } catch {
      toast.error('Erro ao salvar o conector.')
      if (!isSaved) onChange({ ...connection, status: 'erro' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!isSaved) {
      onRemoveNew(connection.id)
      return
    }
    setDeleting(true)
    try {
      const client = axiosThinkanalise()
      await client.delete(`/thinkanalise/connector/${connection.biconnectorId}`)
      await onDeleted()
      toast.success('Conector removido.')
    } catch {
      await onDeleted()
    } finally {
      setDeleting(false)
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
        onClick={() => setExpanded(prev => !prev)}
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
            <span className="text-gray-300 font-normal">sem nome</span>
          )}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-xs text-gray-400 font-mono">
            {connection.status}
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
                  Nome
                </label>
                <input
                  type="text"
                  value={connection.label}
                  onChange={e => updateNew({ label: e.target.value })}
                  placeholder="Nome da conexão"
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
                  Nome
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
                Integração
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
                  Fontes ({sources.length})
                </span>
                {!addingSource && (
                  <button
                    onClick={() => setAddingSource(true)}
                    className="flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-lg border border-[#e5e7eb] text-gray-400
                               hover:bg-[#eef2f9] hover:text-[#223f6e] hover:border-[#223f6e] transition-all cursor-pointer"
                  >
                    <span className="text-base leading-none">+</span>
                    nova fonte
                  </button>
                )}
              </div>

              {sources.map(s => (
                <SourceCard
                  key={s.id}
                  source={s}
                  connectorId={connection.biconnectorId!}
                  provider={connection.provider}
                  onSaved={async () => {
                    await onSourcesChanged?.()
                  }}
                  onDeleted={async () => {
                    await onSourcesChanged?.()
                  }}
                  datasets={datasets.filter(d => d.sourceId === s.id)}
                  onDatasetsChanged={onDatasetsChanged}
                />
              ))}

              {addingSource && (
                <NewSourceCard
                  connectorId={connection.biconnectorId!}
                  provider={connection.provider}
                  onSaved={async () => {
                    setAddingSource(false)
                    await onSourcesChanged?.()
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
              {deleting ? 'removendo...' : 'remover'}
            </button>

            {isSaved && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm font-semibold px-5 py-2 rounded-lg border border-[#223f6e] text-[#223f6e] hover:bg-[#eef2f9] transition-colors cursor-pointer"
              >
                editar
              </button>
            )}

            {isSaved && isEditing && (
              <>
                <button
                  onClick={handleCancelEdit}
                  className="text-xs font-mono px-3.5 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400
                             hover:bg-gray-50 transition-all cursor-pointer"
                >
                  cancelar
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving || !draft.label}
                  className="text-sm font-semibold px-5 py-2 rounded-lg bg-[#223f6e] text-white hover:bg-[#1a3058] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'salvando...' : 'salvar'}
                </button>
              </>
            )}

            {!isSaved && (
              <button
                onClick={() => void handleSave()}
                disabled={saving || !connection.label}
                className="text-sm font-semibold px-5 py-2 rounded-lg bg-[#223f6e] text-white hover:bg-[#1a3058] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'salvando...' : 'salvar'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
