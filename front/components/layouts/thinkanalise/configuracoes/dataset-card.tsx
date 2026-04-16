'use client'

import { useEffect, useState } from 'react'
import type { Dataset, DatasetField } from '../../types/thinkanalise-types'
import { axiosThinkanalise } from '@/infra/client/axios-thinkanalise'

const AUTH_TOKEN_KEY = 'hubthink_auth_token'

function toFieldName(str: string): string {
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
}

// ─── DatasetCard (dataset existente) ────────────────────────────────────────

type DatasetCardProps = {
  dataset: Dataset
  onChanged: () => Promise<void>
  onDeleted: () => Promise<void>
}

export function DatasetCard({
  dataset,
  onChanged,
  onDeleted,
}: DatasetCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(dataset.name)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [fields, setFields] = useState<DatasetField[]>(dataset.fields ?? [])

  function toggleVisible(externalCode: string) {
    setFields(prev =>
      prev.map(f =>
        f.externalCode === externalCode ? { ...f, visible: !f.visible } : f,
      ),
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      await client.put(`/thinkanalise/dataset/${dataset.id}`, { name })
      await onChanged()
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleSyncFields() {
    setSyncing(true)
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      await client.put(`/thinkanalise/dataset/${dataset.id}/fields`, { fields })
      await onChanged()
    } finally {
      setSyncing(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      await client.delete(`/thinkanalise/dataset/${dataset.id}`)
      await onDeleted()
    } catch {
      setDeleteError(
        'Não foi possível remover. Verifique se o dataset está em uso no BI Builder.',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white overflow-hidden">
      {/* cabeçalho */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(p => !p)}
      >
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#e8eef7] text-[#223f6e] border border-[#e5e7eb] uppercase tracking-wide">
          {dataset.externalCode}
        </span>
        <span className="text-sm font-medium text-gray-700 flex-1">
          {dataset.name}
        </span>
        <span className="text-xs text-gray-400 font-mono">
          {(dataset.fields ?? []).length} campos
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        >
          <path
            d="M2 4l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {expanded && (
        <>
          {/* nome editável */}
          {isEditing && (
            <div className="px-4 pb-3">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full font-mono text-sm px-3 py-2 rounded-lg border border-[#e5e7eb] bg-[#F9F9FB] text-black outline-none
                           focus:border-[#223f6e] focus:ring-2 focus:ring-[#223f6e]/20 focus:bg-white"
              />
            </div>
          )}

          {/* lista de campos */}
          <div className="px-4 pb-3 flex flex-col gap-1">
            {fields.map(f => (
              <div
                key={f.externalCode}
                className="flex items-center gap-3 py-1.5 border-b border-[#f3f4f6] last:border-0"
              >
                <span className="text-xs font-mono text-gray-500 w-32 truncate">
                  {f.name}
                </span>
                <span className="text-[10px] font-mono text-gray-400 flex-1">
                  {f.externalCode}
                </span>
                <span className="text-[10px] font-mono text-gray-400 w-16">
                  {f.type}
                </span>
                <button
                  onClick={() => toggleVisible(f.externalCode)}
                  title={f.visible ? 'Ocultar no BI' : 'Exibir no BI'}
                  className={`w-2 h-2 rounded-full transition-colors cursor-pointer ${f.visible ? 'bg-[#4a7fd4]' : 'bg-gray-300'}`}
                />
              </div>
            ))}
          </div>

          {/* erro de deleção */}
          {deleteError && (
            <div className="px-4 pb-2">
              <p className="text-xs font-mono text-red-500">{deleteError}</p>
            </div>
          )}

          {/* rodapé */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-[#e5e7eb]">
            <button
              onClick={() => void handleSyncFields()}
              disabled={syncing}
              className="text-xs font-mono px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400
                         hover:bg-[#eef2f9] hover:text-[#223f6e] hover:border-[#223f6e] transition-all disabled:opacity-50 cursor-pointer"
            >
              {syncing ? 'sincronizando...' : 'sincronizar campos'}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="text-xs font-mono px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400
                           hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-50 cursor-pointer"
              >
                {deleting ? 'removendo...' : 'remover'}
              </button>

              {isEditing ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setName(dataset.name)
                    }}
                    className="text-xs font-mono px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400 hover:bg-gray-50 cursor-pointer"
                  >
                    cancelar
                  </button>
                  <button
                    onClick={() => void handleSave()}
                    disabled={saving || !name}
                    className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-[#223f6e] text-white hover:bg-[#1a3058] disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'salvando...' : 'salvar'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#223f6e] text-[#223f6e] hover:bg-[#eef2f9] transition-colors cursor-pointer"
                >
                  editar
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── NewDatasetCard (criação em 2 passos) ────────────────────────────────────

type TableEntry = { code: string; title: string }
type DescribeField = { code: string; name: string; type: string }

type NewDatasetCardProps = {
  sourceId: number
  integration: string
  onSaved: () => Promise<void>
  onCancel: () => void
}

export function NewDatasetCard({
  sourceId,
  integration,
  onSaved,
  onCancel,
}: NewDatasetCardProps) {
  const [step, setStep] = useState<'table' | 'fields'>('table')
  const [tables, setTables] = useState<TableEntry[]>([])
  const [loadingTables, setLoadingTables] = useState(false)
  const [selectedTable, setSelectedTable] = useState<TableEntry | null>(null)
  const [describeFields, setDescribeFields] = useState<DescribeField[]>([])
  const [loadingFields, setLoadingFields] = useState(false)
  const [datasetName, setDatasetName] = useState('')
  const [visibility, setVisibility] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  async function loadTables() {
    setLoadingTables(true)
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      const tables = await client.post<TableEntry[]>('/thinkanalise/tables', {
        connection: { integration, api_key: '' },
      })
      setTables(tables as unknown as TableEntry[])
    } finally {
      setLoadingTables(false)
    }
  }

  async function selectTable(table: TableEntry) {
    setSelectedTable(table)
    setDatasetName(table.title)
    setLoadingFields(true)
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      const fields = (await client.post<DescribeField[]>(
        '/thinkanalise/describe',
        {
          name: table.code,
          connection: { integration, api_key: '' },
        },
      )) as unknown as DescribeField[]
      setDescribeFields(fields)
      const vis: Record<string, boolean> = {}
      fields.forEach(f => {
        vis[f.code] = true
      })
      setVisibility(vis)
      setStep('fields')
    } finally {
      setLoadingFields(false)
    }
  }

  async function handleSave() {
    if (!selectedTable || !datasetName) return
    setSaving(true)
    try {
      const client = axiosThinkanalise(AUTH_TOKEN_KEY)
      await client.post(`/thinkanalise/source/${sourceId}/dataset`, {
        name: datasetName,
        externalCode: selectedTable.code,
        externalName: selectedTable.title,
        fields: describeFields.map(f => ({
          name: f.name,
          type: f.type,
          externalCode: f.code,
          visible: visibility[f.code] ?? true,
        })),
      })
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    void loadTables()
  }, [])

  return (
    <div className="rounded-lg border border-dashed border-[#223f6e]/40 bg-white overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex flex-col gap-3">
        {step === 'table' && (
          <>
            <p className="text-[11px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
              Selecione a tabela
            </p>
            {loadingTables ? (
              <p className="text-xs text-gray-400 font-mono">carregando...</p>
            ) : (
              <div className="flex flex-col gap-1">
                {tables.map(t => (
                  <button
                    key={t.code}
                    onClick={() => void selectTable(t)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#e5e7eb] bg-[#F9F9FB]
                               hover:bg-[#eef2f9] hover:border-[#223f6e] transition-all text-left cursor-pointer"
                  >
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#e8eef7] text-[#223f6e] border border-[#e5e7eb] uppercase">
                      {t.code}
                    </span>
                    <span className="text-sm text-gray-700">{t.title}</span>
                    {loadingFields && selectedTable?.code === t.code && (
                      <span className="ml-auto text-xs text-gray-400 font-mono">
                        carregando...
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 'fields' && selectedTable && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
                Nome do Dataset
              </label>
              <input
                type="text"
                value={datasetName}
                onChange={e => setDatasetName(e.target.value)}
                className="w-full font-mono text-sm px-3 py-2 rounded-lg border border-[#e5e7eb] bg-[#F9F9FB] text-black outline-none
                           focus:border-[#223f6e] focus:ring-2 focus:ring-[#223f6e]/20 focus:bg-white"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-widest">
                Campos — clique no ponto para ocultar/exibir no BI
              </label>
              {describeFields.map(f => (
                <div
                  key={f.code}
                  className="flex items-center gap-3 py-1.5 border-b border-[#f3f4f6] last:border-0"
                >
                  <span className="text-xs font-mono text-[#223f6e] w-32 truncate">
                    {toFieldName(f.name)}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 flex-1">
                    {f.code}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 w-16">
                    {f.type}
                  </span>
                  <button
                    onClick={() =>
                      setVisibility(v => ({ ...v, [f.code]: !v[f.code] }))
                    }
                    title={
                      visibility[f.code] ? 'Ocultar no BI' : 'Exibir no BI'
                    }
                    className={`w-2 h-2 rounded-full transition-colors cursor-pointer ${visibility[f.code] ? 'bg-[#4a7fd4]' : 'bg-gray-300'}`}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-[#e5e7eb]">
        <button
          onClick={step === 'fields' ? () => setStep('table') : onCancel}
          className="text-xs font-mono px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-400 hover:bg-gray-50 cursor-pointer"
        >
          {step === 'fields' ? '← voltar' : 'cancelar'}
        </button>

        {step === 'fields' && (
          <button
            onClick={() => void handleSave()}
            disabled={saving || !datasetName}
            className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-[#223f6e] text-white hover:bg-[#1a3058] disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'salvando...' : 'criar dataset'}
          </button>
        )}
      </div>
    </div>
  )
}
