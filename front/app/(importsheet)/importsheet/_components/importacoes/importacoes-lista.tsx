'use client'

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

export function ImportacoesLista({ imports }: { imports: ImportListItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      {imports.map(item => (
        <div
          key={item.id}
          className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4"
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
          <span
            className={
              item.enabled
                ? 'shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600'
                : 'shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground'
            }
          >
            {item.enabled ? 'Ativa' : 'Pausada'}
          </span>
        </div>
      ))}
    </div>
  )
}
