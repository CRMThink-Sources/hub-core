'use client'

import { Building2, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  THINKZAP_PERMISSION_ACTIONS_BY_CATEGORY,
  type ThinkzapPermissionAction,
  type ThinkzapPermissionCategory,
  type ThinkzapUserPermissions,
} from '@/shared/thinkzap-permissions'
import { PermissionCheckbox } from './permission-checkbox'

type DepartmentRow = {
  bitrixDepartmentId: string
  displayName: string | null
  permissions: ThinkzapUserPermissions
}

type Props = {
  category: ThinkzapPermissionCategory
  departments: DepartmentRow[]
  totalCount: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  draftPermissions: Record<string, ThinkzapUserPermissions>
  onPermissionChange: (
    bitrixDepartmentId: string,
    category: ThinkzapPermissionCategory,
    action: ThinkzapPermissionAction,
  ) => void
  onRemove: (bitrixDepartmentId: string) => void
  removingId: string | null
}

export function PermissionsDepartmentsTable({
  category,
  departments,
  totalCount,
  page,
  pageSize,
  onPageChange,
  draftPermissions,
  onPermissionChange,
  onRemove,
  removingId,
}: Props) {
  const { t } = useTranslation('thinkzap/permissoes')
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const actions = THINKZAP_PERMISSION_ACTIONS_BY_CATEGORY[category]

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wide">
              <th
                rowSpan={2}
                className="sticky left-0 z-10 min-w-[220px] bg-muted px-4 py-3 font-semibold text-muted-foreground"
              >
                {t('departments.table.department')}
              </th>
              <th
                colSpan={actions.length}
                className="border-l border-border bg-primary/10 px-2 py-2.5 text-center font-semibold text-primary"
              >
                {t(`matrix.categoriesShort.${category}`)}
              </th>
              <th
                rowSpan={2}
                className="min-w-[80px] border-l border-border bg-muted px-2 py-3 text-center font-semibold text-muted-foreground"
              >
                {t('table.actions')}
              </th>
            </tr>
            <tr className="border-b border-border bg-muted/80 text-[10px] text-muted-foreground">
              {actions.map(action => (
                <th
                  key={action}
                  className="w-20 min-w-20 whitespace-nowrap border-l border-border px-1 py-1.5 text-center font-medium"
                  title={t(`matrix.actions.${action}`)}
                >
                  {t(`matrix.actionsShort.${action}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {departments.map(dept => {
              const permissions = (draftPermissions[dept.bitrixDepartmentId] ??
                dept.permissions)[category] as Record<string, boolean>
              const displayName =
                dept.displayName ?? `Departamento #${dept.bitrixDepartmentId}`

              return (
                <tr
                  key={dept.bitrixDepartmentId}
                  className="group transition-colors hover:bg-accent"
                >
                  <td className="sticky left-0 z-10 bg-card px-4 py-3 transition-colors group-hover:bg-accent">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {displayName}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          ID {dept.bitrixDepartmentId}
                        </p>
                      </div>
                    </div>
                  </td>
                  {actions.map(action => (
                    <td
                      key={`${dept.bitrixDepartmentId}-${action}`}
                      className="w-20 min-w-20 border-l border-border px-1 py-3 text-center"
                    >
                      <PermissionCheckbox
                        checked={permissions[action] === true}
                        label={t(`matrix.actions.${action}`)}
                        onChange={() =>
                          onPermissionChange(
                            dept.bitrixDepartmentId,
                            category,
                            action,
                          )
                        }
                      />
                    </td>
                  ))}
                  <td className="border-l border-border px-2 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        title={t('remove')}
                        disabled={removingId === dept.bitrixDepartmentId}
                        onClick={() => onRemove(dept.bitrixDepartmentId)}
                        className="cursor-pointer rounded-md p-1.5 text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="h-4 w-4" />
          {t('departmentsCount', { count: totalCount })}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="cursor-pointer rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={t('pagination.previous')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-8 rounded-md bg-primary px-2 py-1 text-center text-xs font-medium text-primary-foreground">
            {page}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="cursor-pointer rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={t('pagination.next')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
