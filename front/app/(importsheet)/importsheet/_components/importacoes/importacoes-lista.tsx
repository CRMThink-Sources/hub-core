'use client'

import { useState } from 'react'
import { PencilIcon, PlayIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
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
  onRun: (id: number) => Promise<void>
  onToggleEnabled: (id: number, enabled: boolean) => Promise<void>
}

export function ImportacoesLista({
  imports,
  onEdit,
  onDelete,
  onRun,
  onToggleEnabled,
}: Props) {
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [runningId, setRunningId] = useState<number | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  async function handleRun(id: number) {
    setRunningId(id)
    try {
      await onRun(id)
      toast.success('Importação enfileirada para execução.')
    } catch (error) {
      // Backend pode recusar (ex.: 409 importação pausada) com mensagem útil.
      const serverMessage = isAxiosError(error)
        ? (error.response?.data?.result?.error as string | undefined)
        : undefined
      toast.error(
        serverMessage ?? 'Falha ao executar a importação. Tente novamente.',
      )
    } finally {
      setRunningId(null)
    }
  }

  async function handleToggle(id: number, enabled: boolean) {
    setTogglingId(id)
    try {
      await onToggleEnabled(id, enabled)
      toast.success(enabled ? 'Importação ativada.' : 'Importação pausada.')
    } catch {
      toast.error('Falha ao alterar o status. Tente novamente.')
    } finally {
      setTogglingId(null)
    }
  }

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
            {item.scheduleMode === 'MANUAL' ? (
              // Manual: só execução sob demanda — sem estado ativo/pausado.
              <Button
                variant="outline"
                size="sm"
                disabled={runningId === item.id}
                onClick={() => void handleRun(item.id)}
                title="Executar agora"
              >
                <PlayIcon />
                Executar
              </Button>
            ) : (
              // Agendado: o toggle controla se o agendamento dispara — sem execução manual.
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 transition-colors',
                  item.enabled
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
                    : 'border-border bg-muted',
                )}
                title={
                  item.enabled
                    ? 'Agendamento ativo — clique para pausar'
                    : 'Agendamento pausado — clique para ativar'
                }
              >
                <Switch
                  checked={item.enabled}
                  disabled={togglingId === item.id}
                  onCheckedChange={checked =>
                    void handleToggle(item.id, checked)
                  }
                  aria-label={
                    item.enabled
                      ? 'Pausar agendamento'
                      : 'Ativar agendamento'
                  }
                />
                <span
                  className={cn(
                    'text-xs font-medium',
                    item.enabled
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-muted-foreground',
                  )}
                >
                  {item.enabled ? 'Agendamento ativo' : 'Agendamento pausado'}
                </span>
              </label>
            )}

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
