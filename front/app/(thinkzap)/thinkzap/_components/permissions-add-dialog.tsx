'use client'

import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import type { PermissionsTabMode } from './permissions-mode-tabs'

type SearchHit = {
  id: string | number
  primary: string
  secondary: string
}

type Props = {
  mode: PermissionsTabMode
  isOpen: boolean
  query: string
  searching: boolean
  hits: SearchHit[]
  onClose: () => void
  onQueryChange: (value: string) => void
  onSelect: (hit: SearchHit) => void
}

export function PermissionsAddDialog({
  mode,
  isOpen,
  query,
  searching,
  hits,
  onClose,
  onQueryChange,
  onSelect,
}: Props) {
  const { t } = useTranslation('thinkzap/permissoes')

  if (!isOpen) return null

  const title =
    mode === 'users' ? t('addUserDialogTitle') : t('addDepartmentDialogTitle')
  const placeholder =
    mode === 'users'
      ? t('searchPlaceholder')
      : t('departments.searchPlaceholder')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-gray-100 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={t('closeDialog')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <Input
            type="search"
            autoFocus
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder={placeholder}
          />

          <ul className="mt-3 max-h-64 divide-y divide-gray-50 overflow-y-auto rounded-md border border-gray-100">
            {searching && (
              <li className="px-3 py-3 text-xs text-slate-400">
                {t('searching')}
              </li>
            )}
            {!searching &&
              (mode === 'users' ? query.trim().length >= 2 : true) &&
              hits.length === 0 && (
                <li className="px-3 py-3 text-xs text-slate-400">
                  {mode === 'users' && query.trim().length < 2
                    ? t('searchPlaceholder')
                    : t('noResults')}
                </li>
              )}
            {!searching &&
              hits.map(hit => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(hit)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {hit.primary}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">
                        {hit.secondary}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white">
                      +
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
