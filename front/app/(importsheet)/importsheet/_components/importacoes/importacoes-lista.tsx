'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangleIcon,
  PencilIcon,
  PlayIcon,
  Trash2Icon,
} from 'lucide-react'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { formatPortalDate } from '@/lib/format-date'
import type { ImportListItem } from '../types'
import { ENTITIES, WEEKDAYS } from './configurar-importacao/constants'

type TFn = (key: string, options?: Record<string, unknown>) => string

/** Cor da bolinha de status do último run. */
const STATUS_DOT: Record<string, string> = {
  success: 'bg-emerald-500',
  partial: 'bg-amber-500',
  error: 'bg-red-500',
  running: 'bg-blue-500',
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-block size-1.5 shrink-0 rounded-full',
        STATUS_DOT[status] ?? 'bg-muted-foreground',
        status === 'running' && 'animate-pulse',
      )}
    />
  )
}

function entityLabel(code: ImportListItem['entityCode'], tCfg: TFn): string {
  return ENTITIES.find(e => e.code === code) ? tCfg(`entidades.${code}`) : code
}

function scheduleLabel(item: ImportListItem, t: TFn, tCfg: TFn): string {
  if (item.scheduleMode === 'MANUAL') return t('manual')
  if (item.scheduleMode === 'HOURS')
    return t('aCadaHoras', { horas: item.everyHours })
  const days = (item.weekdays ?? [])
    .map(d =>
      WEEKDAYS.find(w => w.value === d) ? tCfg(`weekdays.${d}`) : String(d),
    )
    .join(', ')
  return days ? t('semanalDias', { dias: days }) : t('semanal')
}

type Props = {
  imports: ImportListItem[]
  onEdit: (id: number) => void
  onDelete: (id: number) => Promise<void>
  onRun: (id: number) => Promise<void>
  onToggleEnabled: (id: number, enabled: boolean) => Promise<void>
  onShowErrors: (id: number) => void
}

export function ImportacoesLista({
  imports,
  onEdit,
  onDelete,
  onRun,
  onToggleEnabled,
  onShowErrors,
}: Props) {
  const { t, i18n } = useTranslation('importsheet/importacoes/lista')
  const { t: tCfg } = useTranslation('importsheet/configurar-importacao')
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [runningId, setRunningId] = useState<number | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  async function handleRun(id: number) {
    setRunningId(id)
    try {
      await onRun(id)
      toast.success(t('toastEnfileirada'))
    } catch (error) {
      // 409 = já na fila/rodando → aviso amigável (não é erro real).
      if (isAxiosError(error) && error.response?.status === 409) {
        toast.info(t('toastJaNaFila'))
        return
      }
      // Demais recusas do backend trazem mensagem útil.
      const serverMessage = isAxiosError(error)
        ? (error.response?.data?.result?.error as string | undefined)
        : undefined
      toast.error(serverMessage ?? t('toastErroExecutar'))
    } finally {
      setRunningId(null)
    }
  }

  async function handleToggle(id: number, enabled: boolean) {
    setTogglingId(id)
    try {
      await onToggleEnabled(id, enabled)
      toast.success(enabled ? t('toastAtivada') : t('toastPausada'))
    } catch {
      toast.error(t('toastErroStatus'))
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
      toast.success(t('toastExcluida'))
    } catch {
      toast.error(t('toastErroExcluir'))
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
            <p className="truncate text-base font-semibold text-foreground">
              {item.title}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {entityLabel(item.entityCode, tCfg)} · {item.spreadsheetName} ·{' '}
              {scheduleLabel(item, t, tCfg)}
            </p>
            <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
              {item.lastRunStatus && <StatusDot status={item.lastRunStatus} />}
              {item.lastRunAt
                ? t('ultimaExecucao', {
                    quando: formatPortalDate(item.lastRunAt, i18n.language),
                  })
                : t('nuncaExecutada')}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {(item.lastRunStatus === 'error' ||
              item.lastRunStatus === 'partial') && (
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  item.lastRunStatus === 'error'
                    ? 'border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40'
                    : 'border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/40',
                )}
                onClick={() => onShowErrors(item.id)}
                title={t('erros.verErros')}
              >
                <AlertTriangleIcon />
                {t('erros.verErros')}
              </Button>
            )}

            {item.scheduleMode === 'MANUAL' ? (
              // Manual: só execução sob demanda — sem estado ativo/pausado.
              // Bloqueia enquanto o run está na fila/rodando (polling reflete o
              // status) — evita reenfileirar; backend também barra com 409.
              (() => {
                const isRunning = item.lastRunStatus === 'running'
                const busy = runningId === item.id || isRunning
                return (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleRun(item.id)}
                    title={isRunning ? t('emExecucao') : t('executarAgora')}
                  >
                    <PlayIcon />
                    {isRunning ? t('emExecucao') : t('executar')}
                  </Button>
                )
              })()
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
                    ? t('agendamentoAtivoTitulo')
                    : t('agendamentoPausadoTitulo')
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
                      ? t('pausarAgendamento')
                      : t('ativarAgendamento')
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
                  {item.enabled
                    ? t('agendamentoAtivo')
                    : t('agendamentoPausado')}
                </span>
              </label>
            )}

            {confirmId === item.id ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive">{t('excluir')}</span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  onClick={() => void handleConfirmDelete()}
                >
                  {t('sim')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={deleting}
                  onClick={() => setConfirmId(null)}
                >
                  {t('nao')}
                </Button>
              </div>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(item.id)}
                  title={t('editarImportacao')}
                >
                  <PencilIcon />
                  {t('editar')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmId(item.id)}
                  title={t('excluirImportacao')}
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
