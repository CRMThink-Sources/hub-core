'use client'

import { Search, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PermissionsTabMode } from './permissions-mode-tabs'

type Props = {
  mode: PermissionsTabMode
  filter: string
  onFilterChange: (value: string) => void
  onAddClick: () => void
}

export function PermissionsToolbar({
  mode,
  filter,
  onFilterChange,
  onAddClick,
}: Props) {
  const { t } = useTranslation('thinkzap/permissoes')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">
          {mode === 'users' ? t('manageByUser') : t('manageByDepartment')}
        </h2>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={filter}
            onChange={e => onFilterChange(e.target.value)}
            placeholder={
              mode === 'users'
                ? t('searchTablePlaceholder')
                : t('searchTablePlaceholderDepartment')
            }
            className="pl-9"
          />
        </div>
        <Button type="button" onClick={onAddClick} className="shrink-0">
          <UserPlus className="h-4 w-4" />
          {mode === 'users' ? t('addUser') : t('departments.addDepartment')}
        </Button>
      </div>
    </div>
  )
}
