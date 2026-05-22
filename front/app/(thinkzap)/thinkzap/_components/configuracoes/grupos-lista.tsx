'use client'

import type { GroupListItem } from '@/app/hooks/group-types'

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
        <h3 className="text-base font-semibold text-black">{labels.titulo}</h3>
        <button
          type="button"
          onClick={onCreateNew}
          className="cursor-pointer rounded-md bg-[#5A997E] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a8169]"
        >
          {labels.novoGrupo}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading && <p className="text-sm text-gray-500">{labels.carregando}</p>}

      {!loading && groups.length === 0 && !error && (
        <p className="text-sm text-gray-500">{labels.vazio}</p>
      )}

      {!loading && groups.length > 0 && (
        <div className="w-full overflow-visible rounded-lg border border-gray-100 bg-white">
          <div className="flex items-center border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
            <div className="min-w-0 flex-1">{labels.colunaNome}</div>
            <div className="hidden w-48 shrink-0 sm:block">
              {labels.colunaUltimaMsg}
            </div>
            <div className="w-36 shrink-0 text-right">{labels.colunaAcoes}</div>
          </div>
          {groups.map(group => (
            <div
              key={group.phone}
              className="flex items-center border-b border-gray-50 px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-black">
                  {group.name || group.phone}
                </p>
                <p className="truncate text-xs text-gray-500 sm:hidden">
                  {formatLastMessageTime(group.lastMessageTime)}
                </p>
              </div>
              <div className="hidden w-48 shrink-0 text-sm text-gray-600 sm:block">
                {formatLastMessageTime(group.lastMessageTime)}
              </div>
              <div className="flex w-36 shrink-0 justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(group.phone)}
                  className="cursor-pointer text-sm text-[#5A997E] hover:underline"
                >
                  {labels.editar}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onLeave(group.phone, group.name || group.phone)
                  }
                  className="cursor-pointer text-sm text-red-600 hover:underline"
                >
                  {labels.sair}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrevPage}
          disabled={page <= 1 || loading}
          className="cursor-pointer rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {labels.anterior}
        </button>
        <span className="text-sm text-gray-600">
          {labels.pagina.replace('{{page}}', String(page))}
        </span>
        <button
          type="button"
          onClick={onNextPage}
          disabled={groups.length === 0 || loading}
          className="cursor-pointer rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {labels.proxima}
        </button>
      </div>
    </div>
  )
}
