'use client'

import { useState } from 'react'
import { PROVIDERS } from './constants'
import type { Connection } from '../../types/thinkanalise-types'
import { axiosThinkanalise } from '@/infra/client/axios-thinkanalise'

const AUTH_TOKEN_KEY = 'hubthink_auth_token'

type Props = {
  connection: Connection
  onChange: (updated: Connection) => void
  onSaved: (id: string) => Promise<void>
  onDeleted: () => Promise<void>
  onRemoveNew: (id: string) => void
}

export function ConfigCard({
  connection,
  onChange,
  onSaved,
  onDeleted,
  onRemoveNew,
}: Props) {
  const isSaved = !!connection.biconnectorId

  // draft só existe para conectores salvos em modo edição
  const [draft, setDraft] = useState({ label: connection.label, apiKey: '' })
  const [isEditing, setIsEditing] = useState(false)

  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'erro'>('idle')
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [expanded, setExpanded] = useState(!isSaved)

  // Para novos conectores: atualiza o estado do pai normalmente
  function updateNew(patch: Partial<Connection>) {
    onChange({ ...connection, ...patch })
  }

  function handleCancelEdit() {
    setDraft({ label: connection.label, apiKey: '' })
    setIsEditing(false)
    setTestStatus('idle')
  }

  const currentLabel =
    isSaved && !isEditing
      ? connection.label
      : isSaved
        ? draft.label
        : connection.label
  const currentApiKey = isSaved ? draft.apiKey : connection.apiKey
  const isReadOnly = isSaved && !isEditing

  async function handleTest() {
    setTesting(true)
    setTestStatus('idle')
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      await client.post('/thinkanalise/check', {
        connection: {
          integration: connection.provider,
          api_key: currentApiKey,
        },
      })
      setTestStatus('ok')
    } catch {
      setTestStatus('erro')
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      if (isSaved) {
        await client.put(
          `/thinkanalise/connector/${connection.biconnectorId}`,
          {
            label: draft.label,
            ...(draft.apiKey && { apiKey: draft.apiKey }),
          },
        )
        await onSaved(connection.id)
      } else {
        if (!connection.label || !connection.apiKey) return
        await client.post('/thinkanalise/connector', {
          label: connection.label,
          provider: connection.provider,
          apiKey: connection.apiKey,
        })
        await onSaved(connection.id)
      }
    } catch {
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
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      await client.delete(`/thinkanalise/connector/${connection.biconnectorId}`)
      await onDeleted()
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
        <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded bg-[#e8eef7] text-[#223f6e] border border-[#e5e7eb] tracking-wide uppercase">
          {connection.provider}
        </span>

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
                {PROVIDERS.map(p => (
                  <option key={p.value} value={p.value} disabled={p.disabled}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* api key */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
                API Key
              </label>
              <input
                type="password"
                value={currentApiKey}
                onChange={e =>
                  isSaved
                    ? setDraft(d => ({ ...d, apiKey: e.target.value }))
                    : updateNew({ apiKey: e.target.value })
                }
                disabled={isReadOnly}
                placeholder={
                  isReadOnly
                    ? '••••••••••••'
                    : isSaved
                      ? 'Nova chave (deixe em branco para manter)'
                      : 'Cole sua chave aqui'
                }
                className="w-full font-mono text-sm px-3 py-2.5 rounded-lg border border-[#e5e7eb] bg-[#F9F9FB] text-black outline-none
                           focus:border-[#223f6e] focus:ring-2 focus:ring-[#223f6e]/20 focus:bg-white
                           hover:border-[#223f6e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* rodapé */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#e5e7eb] flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {!isReadOnly && (
                <button
                  onClick={() => void handleTest()}
                  disabled={testing || !currentApiKey}
                  className="flex items-center gap-1.5 text-xs font-mono px-3.5 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400
                             hover:bg-[#eef2f9] hover:text-[#223f6e] hover:border-[#223f6e] transition-all disabled:opacity-50 cursor-pointer"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5.5" stroke="currentColor" />
                    <path
                      d="M4 6h4M6 4v4"
                      stroke="currentColor"
                      strokeLinecap="round"
                    />
                  </svg>
                  {testing ? 'testando...' : 'testar conexão'}
                </button>
              )}

              {testStatus === 'ok' && (
                <span className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-[#e8eef7] text-[#223f6e] border border-[#e5e7eb]">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6.5" stroke="#4a7fd4" />
                    <path
                      d="M4 7l2 2 4-4"
                      stroke="#4a7fd4"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                  conexão ok
                </span>
              )}
              {testStatus === 'erro' && (
                <span className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6.5" stroke="#b91c1c" />
                    <path
                      d="M5 5l4 4M9 5l-4 4"
                      stroke="#b91c1c"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                  api key inválida
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
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
                  disabled={saving || !connection.label || !connection.apiKey}
                  className="text-sm font-semibold px-5 py-2 rounded-lg bg-[#223f6e] text-white hover:bg-[#1a3058] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'salvando...' : 'salvar'}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
