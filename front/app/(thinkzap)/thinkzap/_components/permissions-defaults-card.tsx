'use client'

import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PermissionsMatrix } from './permissions-matrix'
import type { ThinkzapUserPermissions } from '@/shared/thinkzap-permissions'
import type { PermissionsTabMode } from './permissions-mode-tabs'

type Props = {
  mode: PermissionsTabMode
  value: ThinkzapUserPermissions
  onChange: (next: ThinkzapUserPermissions) => void
}

export function PermissionsDefaultsCard({ mode, value, onChange }: Props) {
  const { t } = useTranslation('thinkzap/permissoes')

  const title =
    mode === 'users'
      ? t('defaultPermissionsForNewUser')
      : t('departments.defaultPermissionsForNewDepartment')

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Info className="h-4 w-4 text-blue-600" />
        <p className="text-sm font-medium text-slate-700">{title}</p>
      </div>
      <PermissionsMatrix variant="defaults" value={value} onChange={onChange} />
    </div>
  )
}
