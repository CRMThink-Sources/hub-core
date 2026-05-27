'use client'

import { useState } from 'react'
import type { Dataset } from '../../../types/thinkanalise-types'
import { axiosThinkanalise } from '@/infra/client/axios-thinkanalise'
import { useLoading } from '@/providers/loading-provider'
import { useTranslation } from 'react-i18next'

type Props = {
  dataset: Dataset
  onChanged: () => Promise<void>
  onDeleted: () => Promise<void>
}

export function DatasetCard({ dataset, onChanged, onDeleted }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(dataset.name)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { setLoading } = useLoading()
  const { t } = useTranslation('thinkanalise/configuracoes/dataset')

  async function handleSave() {
    setSaving(true)
    setLoading(true, t('loading.salvando'))
    try {
      const client = axiosThinkanalise()
      await client.put(`/thinkanalise/dataset/${dataset.id}`, { name })
      await onChanged()
      setIsEditing(false)
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setLoading(true, t('loading.removendo'))
    setDeleteError(null)
    try {
      const client = axiosThinkanalise()
      await client.delete(`/thinkanalise/dataset/${dataset.id}`)
      await onDeleted()
    } catch {
      setDeleteError(t('erroRemover'))
    } finally {
      setDeleting(false)
      setLoading(false)
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
          {(dataset.fields ?? []).length} {t('campos')}
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
            {(dataset.fields ?? []).map(f => (
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
              </div>
            ))}
          </div>

          {/* erro de deleção */}
          {deleteError && (
            <div className="px-4 pb-2">
              <p className="text-xs font-mono text-red-500">{deleteError}</p>
            </div>
          )}

          {/* editar/excluir dataset — vai ser adicionado futuramente (API Bitrix não permite no momento) */}
          <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-[#e5e7eb]">
            <span title={t('tooltip.desativado')}>
              <button
                disabled
                className="text-xs font-mono px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-300 cursor-not-allowed"
              >
                {t('acoes.excluir')}
              </button>
            </span>
            <span title={t('tooltip.desativado')}>
              <button
                disabled
                className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-300 cursor-not-allowed"
              >
                {t('acoes.editar')}
              </button>
            </span>
          </div>
        </>
      )}
    </div>
  )
}
