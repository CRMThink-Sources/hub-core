'use client'

import { useState } from 'react'
import type { Dataset, Source, SourceSettings } from '../../types/thinkanalise-types'
import { axiosThinkanalise } from '@/infra/client/axios-thinkanalise'
import { DatasetCard, NewDatasetCard } from './dataset-card'

const AUTH_TOKEN_KEY = 'hubthink_auth_token'

type Props = {
  source: Source
  connectorId: number
  provider: string
  onSaved: () => Promise<void>
  onDeleted: () => Promise<void>
  datasets?: Dataset[]
  onDatasetsChanged?: () => Promise<void>
}

type NewSourceProps = {
  connectorId: number
  provider: string
  onSaved: () => Promise<void>
  onCancel: () => void
}

export function SourceCard({
  source,
  connectorId,
  provider,
  onSaved,
  onDeleted,
  datasets = [],
  onDatasetsChanged,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState({ title: source.title, apiKey: '' })
  const [addingDataset, setAddingDataset] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'erro'>('idle')
  const [testing, setTesting] = useState(false)

  function handleCancelEdit() {
    setDraft({ title: source.title, apiKey: '' })
    setIsEditing(false)
    setTestStatus('idle')
  }

  async function handleTest() {
    const apiKey = draft.apiKey || source.settings.api_key
    setTesting(true)

    setTestStatus('idle')
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      await client.post('/thinkanalise/check', {
        connection: { integration: provider, api_key: apiKey },
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
      const fields: { title?: string; settings?: SourceSettings } = {}
      if (draft.title !== source.title) fields.title = draft.title
      if (draft.apiKey)
        fields.settings = { integration: provider, api_key: draft.apiKey }
      await client.put(`/thinkanalise/source/${source.id}`, fields)
      await onSaved()
      setIsEditing(false)
      setDraft(d => ({ ...d, apiKey: '' }))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      await client.delete(`/thinkanalise/source/${source.id}`)
      await onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  async function handleToggleActive() {
    const client = axiosThinkanalise(AUTH_TOKEN_KEY)
    await client.put(`/thinkanalise/source/${source.id}`, {
      active: !source.active,
    })
    await onSaved()
  }

  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-[#F9F9FB] overflow-hidden">
      {/* cabeçalho da fonte */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-sm font-medium text-gray-700 flex-1">
          {isEditing ? (
            <input
              type="text"
              value={draft.title}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              className="w-full font-mono text-sm px-2 py-1 rounded border border-[#e5e7eb] bg-white outline-none focus:border-[#223f6e]"
            />
          ) : (
            source.title
          )}
        </span>

        <button
          onClick={() => void handleToggleActive()}
          title={source.active ? 'Desativar' : 'Ativar'}
          className={`w-2 h-2 rounded-full transition-colors cursor-pointer ${source.active ? 'bg-[#4a7fd4]' : 'bg-gray-300'}`}
        />
        <span className="text-xs text-gray-400 font-mono">
          {source.active ? 'ativo' : 'inativo'}
        </span>
      </div>

      {/* campos em edição */}
      {isEditing && (
        <div className="px-4 pb-3 flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
              API Key
            </label>
            <input
              type="password"
              value={draft.apiKey}
              onChange={e => setDraft(d => ({ ...d, apiKey: e.target.value }))}
              placeholder="Nova chave (deixe em branco para manter)"
              className="w-full font-mono text-sm px-3 py-2 rounded-lg border border-[#e5e7eb] bg-white text-black outline-none
                         focus:border-[#223f6e] focus:ring-2 focus:ring-[#223f6e]/20
                         hover:border-[#223f6e] transition-colors"
            />
          </div>

          {/* teste de conexão */}
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => void handleTest()}
              disabled={testing}
              className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400
                         hover:bg-[#eef2f9] hover:text-[#223f6e] hover:border-[#223f6e] transition-all disabled:opacity-50 cursor-pointer"
            >
              {testing ? 'testando...' : 'testar conexão'}
            </button>
            {testStatus === 'ok' && (
              <span className="text-xs font-mono text-[#4a7fd4]">
                conexão ok
              </span>
            )}
            {testStatus === 'erro' && (
              <span className="text-xs font-mono text-red-600">
                api key inválida
              </span>
            )}
          </div>
        </div>
      )}

      {/* seção de datasets */}
      <div className="px-4 pb-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
            Datasets ({datasets.length})
          </span>
          {!addingDataset && (
            <button
              onClick={() => setAddingDataset(true)}
              className="flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-lg border border-[#e5e7eb] text-gray-400
                         hover:bg-[#eef2f9] hover:text-[#223f6e] hover:border-[#223f6e] transition-all cursor-pointer"
            >
              <span className="text-base leading-none">+</span>
              novo dataset
            </button>
          )}
        </div>

        {datasets.map(d => (
          <DatasetCard
            key={d.id}
            dataset={d}
            onChanged={async () => { await onDatasetsChanged?.() }}
            onDeleted={async () => { await onDatasetsChanged?.() }}
          />
        ))}

        {addingDataset && (
          <NewDatasetCard
            sourceId={source.id}
            integration={provider}
            onSaved={async () => {
              setAddingDataset(false)
              await onDatasetsChanged?.()
            }}
            onCancel={() => setAddingDataset(false)}
          />
        )}
      </div>

      {/* rodapé */}
      <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-[#e5e7eb]">
        {isEditing ? (
          <>
            <button
              onClick={handleCancelEdit}
              className="text-xs font-mono px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400 hover:bg-gray-50 transition-all cursor-pointer"
            >
              cancelar
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={saving || !draft.title}
              className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-[#223f6e] text-white hover:bg-[#1a3058] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'salvando...' : 'salvar'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="text-xs font-mono px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400
                         hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-50 cursor-pointer"
            >
              {deleting ? 'removendo...' : 'remover'}
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#223f6e] text-[#223f6e] hover:bg-[#eef2f9] transition-colors cursor-pointer"
            >
              editar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function NewSourceCard({
  connectorId,
  provider,
  onSaved,
  onCancel,
}: NewSourceProps) {
  const [title, setTitle] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'erro'>('idle')
  const [testing, setTesting] = useState(false)

  async function handleTest() {
    setTesting(true)
    setTestStatus('idle')
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      await client.post('/thinkanalise/check', {
        connection: { integration: provider, api_key: apiKey },
      })
      setTestStatus('ok')
    } catch {
      setTestStatus('erro')
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    if (!title || !apiKey) return
    setSaving(true)
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      await client.post(`/thinkanalise/connector/${connectorId}/source`, {
        title,
        settings: { integration: provider, api_key: apiKey },
        active: true,
      })
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-[#223f6e]/40 bg-white overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
            Nome da Fonte
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Clientes inadimplentes"
            className="w-full font-mono text-sm px-3 py-2 rounded-lg border border-[#e5e7eb] bg-[#F9F9FB] text-black outline-none
                       focus:border-[#223f6e] focus:ring-2 focus:ring-[#223f6e]/20 focus:bg-white
                       hover:border-[#223f6e] transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Cole sua chave aqui"
            className="w-full font-mono text-sm px-3 py-2 rounded-lg border border-[#e5e7eb] bg-[#F9F9FB] text-black outline-none
                       focus:border-[#223f6e] focus:ring-2 focus:ring-[#223f6e]/20 focus:bg-white
                       hover:border-[#223f6e] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleTest()}
            disabled={testing || !apiKey}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400
                       hover:bg-[#eef2f9] hover:text-[#223f6e] hover:border-[#223f6e] transition-all disabled:opacity-50 cursor-pointer"
          >
            {testing ? 'testando...' : 'testar conexão'}
          </button>
          {testStatus === 'ok' && (
            <span className="text-xs font-mono text-[#4a7fd4]">conexão ok</span>
          )}
          {testStatus === 'erro' && (
            <span className="text-xs font-mono text-red-600">
              api key inválida
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-[#e5e7eb]">
        <button
          onClick={onCancel}
          className="text-xs font-mono px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400 hover:bg-gray-50 transition-all cursor-pointer"
        >
          cancelar
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={saving || !title || !apiKey}
          className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-[#223f6e] text-white hover:bg-[#1a3058] transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saving ? 'salvando...' : 'salvar fonte'}
        </button>
      </div>
    </div>
  )
}
