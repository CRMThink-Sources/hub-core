'use client'

import { useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import type { Dataset } from '../../types'
import { axiosThinkanalise } from '../../../_lib/thinkanalise-client'
import { useLoading } from '@/providers/loading-provider'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* cabeçalho */}
      <button
        type="button"
        onClick={() => setExpanded(p => !p)}
        className="flex w-full select-none items-center gap-3 px-4 py-3 text-left"
      >
        <span className="rounded border border-border bg-accent px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent-foreground">
          {dataset.externalCode}
        </span>
        <span className="flex-1 text-sm font-medium text-foreground">
          {dataset.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {(dataset.fields ?? []).length} {t('campos')}
        </span>
        <ChevronDownIcon
          className={cn(
            'size-4 text-muted-foreground transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <>
          {/* nome editável */}
          {isEditing && (
            <div className="px-4 pb-3">
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}

          {/* lista de campos */}
          <div className="flex flex-col gap-1 px-4 pb-3">
            {(dataset.fields ?? []).map(f => (
              <div
                key={f.externalCode}
                className="flex items-center gap-3 border-b border-border/60 py-1.5 last:border-0"
              >
                <span className="w-32 truncate text-xs text-foreground">
                  {f.name}
                </span>
                <span className="flex-1 text-[10px] text-muted-foreground">
                  {f.externalCode}
                </span>
                <span className="w-16 text-[10px] text-muted-foreground">
                  {f.type}
                </span>
              </div>
            ))}
          </div>

          {/* erro de deleção */}
          {deleteError && (
            <div className="px-4 pb-2">
              <p className="text-xs text-destructive">{deleteError}</p>
            </div>
          )}

          {/* editar/excluir dataset — vai ser adicionado futuramente (API Bitrix não permite no momento) */}
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
            <span title={t('tooltip.desativado')}>
              <Button variant="outline" size="sm" disabled>
                {t('acoes.excluir')}
              </Button>
            </span>
            <span title={t('tooltip.desativado')}>
              <Button variant="outline" size="sm" disabled>
                {t('acoes.editar')}
              </Button>
            </span>
          </div>
        </>
      )}
    </div>
  )
}
