'use client'

import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

  const title =
    mode === 'users' ? t('addUserDialogTitle') : t('addDepartmentDialogTitle')
  const placeholder =
    mode === 'users'
      ? t('searchPlaceholder')
      : t('departments.searchPlaceholder')

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next, details) => {
        if (next) return
        if (details.reason === 'outside-press') return
        onClose()
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <Input
            type="search"
            autoFocus
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder={placeholder}
          />

          <ul className="mt-3 max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {searching && (
              <li className="px-3 py-3 text-xs text-muted-foreground">
                {t('searching')}
              </li>
            )}
            {!searching &&
              (mode === 'users' ? query.trim().length >= 2 : true) &&
              hits.length === 0 && (
                <li className="px-3 py-3 text-xs text-muted-foreground">
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
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {hit.primary}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {hit.secondary}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                      +
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
