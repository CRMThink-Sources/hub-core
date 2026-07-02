'use client'

import { Search, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import type { PermissionsTabMode } from './permissions-mode-tabs'

type Props = {
  mode: PermissionsTabMode
  filter: string
  onFilterChange: (value: string) => void
}

export function PermissionsToolbar({ mode, filter, onFilterChange }: Props) {
  const { t } = useTranslation('thinkzap/permissoes')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">
          {mode === 'users' ? t('manageByUser') : t('manageByDepartment')}
        </h2>
      </div>

      <div className="relative min-w-0">
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
    </div>
  )
}
