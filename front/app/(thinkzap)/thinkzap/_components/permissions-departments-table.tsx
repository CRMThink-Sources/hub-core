'use client'

import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  THINKZAP_PERMISSION_ACTIONS,
  THINKZAP_PERMISSION_CATEGORIES,
  type ThinkzapPermissionAction,
  type ThinkzapUserPermissions,
} from '@/shared/thinkzap-permissions'
import { PermissionCheckbox } from './permission-checkbox'

type DepartmentRow = {
  bitrixDepartmentId: string
  displayName: string | null
  permissions: ThinkzapUserPermissions
}

type Props = {
  departments: DepartmentRow[]
  totalCount: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  draftPermissions: Record<string, ThinkzapUserPermissions>
  onPermissionChange: (
    bitrixDepartmentId: string,
    category: (typeof THINKZAP_PERMISSION_CATEGORIES)[number],
    action: ThinkzapPermissionAction,
  ) => void
  onRemove: (bitrixDepartmentId: string) => void
  removingId: string | null
}

const CATEGORY_HEADER: Record<
  (typeof THINKZAP_PERMISSION_CATEGORIES)[number],
  string
> = {
  connectors: 'bg-blue-600 text-white',
  finance: 'bg-[#5A997E] text-white',
}

export function PermissionsDepartmentsTable({
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

  return (
    <div className="overflow-hidden rounded-lg border border-gray-100 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 text-[10px] uppercase tracking-wide">
              <th
                rowSpan={2}
                className="sticky left-0 z-10 min-w-[220px] bg-slate-50 px-4 py-3 font-semibold text-slate-600"
              >
                {t('departments.table.department')}
              </th>
              {THINKZAP_PERMISSION_CATEGORIES.map(category => (
                <th
                  key={category}
                  colSpan={THINKZAP_PERMISSION_ACTIONS.length}
                  className={`border-l border-white/20 px-2 py-2 text-center font-semibold ${CATEGORY_HEADER[category]}`}
                >
                  {t(`matrix.categoriesShort.${category}`)}
                </th>
              ))}
              <th
                rowSpan={2}
                className="min-w-[80px] border-l border-gray-100 bg-slate-50 px-2 py-3 text-center font-semibold text-slate-600"
              >
                {t('table.actions')}
              </th>
            </tr>
            <tr className="border-b border-gray-100 bg-slate-50/80 text-[10px] text-slate-500">
              {THINKZAP_PERMISSION_CATEGORIES.map(category =>
                THINKZAP_PERMISSION_ACTIONS.map(action => (
                  <th
                    key={`${category}-${action}`}
                    className="border-l border-gray-100 px-0 py-1.5 text-center font-medium"
                    title={t(`matrix.actions.${action}`)}
                  >
                    {t(`matrix.actionsShort.${action}`)}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {departments.map(dept => {
              const permissions =
                draftPermissions[dept.bitrixDepartmentId] ?? dept.permissions
              const displayName =
                dept.displayName ?? `Departamento #${dept.bitrixDepartmentId}`

              return (
                <tr
                  key={dept.bitrixDepartmentId}
                  className="hover:bg-slate-50/50"
                >
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 hover:bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5A997E]/15 text-[#5A997E]">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">
                          {displayName}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">
                          ID {dept.bitrixDepartmentId}
                        </p>
                      </div>
                    </div>
                  </td>
                  {THINKZAP_PERMISSION_CATEGORIES.map(category =>
                    THINKZAP_PERMISSION_ACTIONS.map(action => (
                      <td
                        key={`${dept.bitrixDepartmentId}-${category}-${action}`}
                        className="border-l border-gray-50 px-0 py-3 text-center"
                      >
                        <PermissionCheckbox
                          checked={permissions[category][action]}
                          label={t(`matrix.actions.${action}`)}
                          category={category}
                          onChange={() =>
                            onPermissionChange(
                              dept.bitrixDepartmentId,
                              category,
                              action,
                            )
                          }
                        />
                      </td>
                    )),
                  )}
                  <td className="border-l border-gray-100 px-2 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <span
                        className="rounded p-1 text-slate-400"
                        title={t('editPermissions')}
                      >
                        <Pencil className="h-4 w-4" />
                      </span>
                      <button
                        type="button"
                        title={t('remove')}
                        disabled={removingId === dept.bitrixDepartmentId}
                        onClick={() => onRemove(dept.bitrixDepartmentId)}
                        className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-30"
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

      <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Building2 className="h-4 w-4" />
          {t('departmentsCount', { count: totalCount })}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-md border border-gray-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
            aria-label={t('pagination.previous')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-8 rounded-md bg-blue-600 px-2 py-1 text-center text-xs font-medium text-white">
            {page}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-md border border-gray-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
            aria-label={t('pagination.next')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
