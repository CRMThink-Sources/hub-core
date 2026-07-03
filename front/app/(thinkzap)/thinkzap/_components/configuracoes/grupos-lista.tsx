'use client'

import type { GroupListItem } from '@/app/hooks/group-types'
import { Button } from '@/components/ui/button'

type Props = {
  groups: GroupListItem[]
  loading: boolean
  error: string | null
  page: number
  onEdit: (groupId: string) => void
  onLeave: (groupId: string, groupName: string) => void
  onCreateNew: () => void
  onPrevPage: () => void
  onNextPage: () => void
  labels: {
    titulo: string
    novoGrupo: string
    colunaNome: string
    colunaUltimaMsg: string
    colunaAcoes: string
    editar: string
    sair: string
    vazio: string
    carregando: string
    anterior: string
    proxima: string
    pagina: string
  }
}

function formatLastMessageTime(ts: string): string {
  const n = Number(ts)
  if (!n || Number.isNaN(n)) return '—'
  return new Date(n).toLocaleString()
}

export function GruposLista({
  groups,
  loading,
  error,
  page,
  onEdit,
  onLeave,
  onCreateNew,
  onPrevPage,
  onNextPage,
  labels,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-semibold text-foreground">
          {labels.titulo}
        </h3>
        <Button type="button" onClick={onCreateNew}>
          {labels.novoGrupo}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading && (
        <p className="text-sm text-muted-foreground">{labels.carregando}</p>
      )}

      {!loading && groups.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">{labels.vazio}</p>
      )}

      {!loading && groups.length > 0 && (
        <div className="w-full overflow-visible rounded-xl border border-border bg-card">
          <div className="flex items-center border-b border-border bg-muted px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <div className="min-w-0 flex-1">{labels.colunaNome}</div>
            <div className="hidden w-48 shrink-0 sm:block">
              {labels.colunaUltimaMsg}
            </div>
            <div className="w-36 shrink-0 text-right">{labels.colunaAcoes}</div>
          </div>
          {groups.map(group => (
            <div
              key={group.phone}
              className="flex items-center border-b border-border px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {group.name || group.phone}
                </p>
                <p className="truncate text-xs text-muted-foreground sm:hidden">
                  {formatLastMessageTime(group.lastMessageTime)}
                </p>
              </div>
              <div className="hidden w-48 shrink-0 text-sm text-muted-foreground sm:block">
                {formatLastMessageTime(group.lastMessageTime)}
              </div>
              <div className="flex w-36 shrink-0 justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(group.phone)}
                  className="cursor-pointer text-sm text-primary hover:underline"
                >
                  {labels.editar}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onLeave(group.phone, group.name || group.phone)
                  }
                  className="cursor-pointer text-sm text-destructive hover:underline"
                >
                  {labels.sair}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrevPage}
          disabled={page <= 1 || loading}
        >
          {labels.anterior}
        </Button>
        <span className="text-sm text-muted-foreground">
          {labels.pagina.replace('{{page}}', String(page))}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNextPage}
          disabled={groups.length === 0 || loading}
        >
          {labels.proxima}
        </Button>
      </div>
    </div>
  )
}
