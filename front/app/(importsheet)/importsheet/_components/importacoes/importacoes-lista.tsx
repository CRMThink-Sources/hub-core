'use client'

import { useState } from 'react'
import { PencilIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { ImportListItem } from '../types'
import { ENTITIES, WEEKDAYS } from './configurar-importacao/constants'

function entityLabel(code: ImportListItem['entityCode']): string {
  return ENTITIES.find(e => e.code === code)?.label ?? code
}

function scheduleLabel(item: ImportListItem): string {
  if (item.scheduleMode === 'MANUAL') return 'Manual'
  if (item.scheduleMode === 'HOURS') return `A cada ${item.everyHours}h`
  const days = (item.weekdays ?? [])
    .map(d => WEEKDAYS.find(w => w.value === d)?.label ?? d)
    .join(', ')
  return days ? `Semanal: ${days}` : 'Semanal'
}

type Props = {
  imports: ImportListItem[]
  onEdit: (id: number) => void
  onDelete: (id: number) => Promise<void>
}

export function ImportacoesLista({ imports, onEdit, onDelete }: Props) {
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleConfirmDelete() {
    if (confirmId === null) return
    setDeleting(true)
    try {
      await onDelete(confirmId)
      setConfirmId(null)
      toast.success('Importação excluída.')
    } catch {
      toast.error('Falha ao excluir a importação. Tente novamente.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {imports.map(item => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {item.title}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {entityLabel(item.entityCode)} · {item.spreadsheetName} ·{' '}
              {scheduleLabel(item)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span
              className={
                item.enabled
                  ? 'rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600'
                  : 'rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground'
              }
            >
              {item.enabled ? 'Ativa' : 'Pausada'}
            </span>

            {confirmId === item.id ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive">Excluir?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  onClick={() => void handleConfirmDelete()}
                >
                  Sim
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={deleting}
                  onClick={() => setConfirmId(null)}
                >
                  Não
                </Button>
              </div>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(item.id)}
                  title="Editar importação"
                >
                  <PencilIcon />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmId(item.id)}
                  title="Excluir importação"
                >
                  <Trash2Icon />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
