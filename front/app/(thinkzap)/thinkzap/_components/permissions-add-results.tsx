'use client'

import { useTranslation } from 'react-i18next'
import type { PermissionsTabMode } from './permissions-mode-tabs'

export type AddResultHit = {
  id: string | number
  primary: string
  secondary: string
}

type Props = {
  mode: PermissionsTabMode
  searching: boolean
  hits: AddResultHit[]
  onAdd: (hit: AddResultHit) => void
}

export function PermissionsAddResults({ mode, searching, hits, onAdd }: Props) {
  const { t } = useTranslation('thinkzap/permissoes')

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {searching && (
        <li className="px-3 py-3 text-xs text-muted-foreground">
          {t('searching')}
        </li>
      )}
      {!searching && hits.length === 0 && (
        <li className="px-3 py-3 text-xs text-muted-foreground">
          {mode === 'users' ? t('noResults') : t('departments.noResults')}
        </li>
      )}
      {!searching &&
        hits.map(hit => (
          <li key={hit.id}>
            <button
              type="button"
              onClick={() => onAdd(hit)}
              className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-accent"
            >
              <p className="min-w-0 truncate text-sm">
                <span className="font-medium text-foreground">
                  {hit.primary}
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  - {hit.secondary}
                </span>
              </p>
              <span className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                +
              </span>
            </button>
          </li>
        ))}
    </ul>
  )
}
