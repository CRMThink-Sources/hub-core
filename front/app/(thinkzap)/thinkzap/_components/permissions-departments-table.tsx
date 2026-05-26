'use client'

import { useTranslation } from 'react-i18next'
import {
  THINKZAP_PERMISSION_ACTIONS,
  THINKZAP_PERMISSION_CATEGORIES,
  type ThinkzapPermissionAction,
  type ThinkzapUserPermissions,
} from '@/shared/thinkzap-permissions'

type DepartmentRow = {
  bitrixDepartmentId: string
  displayName: string | null
  permissions: ThinkzapUserPermissions
}

type Props = {
  departments: DepartmentRow[]
  draftPermissions: Record<string, ThinkzapUserPermissions>
  onPermissionChange: (
    bitrixDepartmentId: string,
    category: (typeof THINKZAP_PERMISSION_CATEGORIES)[number],
    action: ThinkzapPermissionAction,
  ) => void
  onSave: (bitrixDepartmentId: string) => void
  onRemove: (bitrixDepartmentId: string) => void
  savingId: string | null
  removingId: string | null
}

function isDirty(
  dept: DepartmentRow,
  draft: Record<string, ThinkzapUserPermissions>,
): boolean {
  const current = draft[dept.bitrixDepartmentId]
  if (!current) return false
  return JSON.stringify(current) !== JSON.stringify(dept.permissions)
}

export function PermissionsDepartmentsTable({
  departments,
  draftPermissions,
  onPermissionChange,
  onSave,
  onRemove,
  savingId,
  removingId,
}: Props) {
  const { t } = useTranslation('thinkzap/permissoes')

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white">
      <table className="min-w-full text-left text-xs">
        <thead>
          <tr className="border-b border-gray-100 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <th className="sticky left-0 z-10 min-w-[180px] bg-slate-50 px-3 py-2 font-medium">
              {t('departments.table.department')}
            </th>
            {THINKZAP_PERMISSION_CATEGORIES.map(category => (
              <th
                key={category}
                colSpan={THINKZAP_PERMISSION_ACTIONS.length}
                className="border-l border-gray-100 px-2 py-2 text-center font-medium"
              >
                {t(`matrix.categoriesShort.${category}`)}
              </th>
            ))}
            <th className="min-w-[72px] border-l border-gray-100 px-2 py-2 text-center font-medium">
              {t('table.actions')}
            </th>
          </tr>
          <tr className="border-b border-gray-100 bg-slate-50/80 text-[10px] text-slate-400">
            <th className="sticky left-0 z-10 bg-slate-50/80 px-3 py-1" />
            {THINKZAP_PERMISSION_CATEGORIES.map(category =>
              THINKZAP_PERMISSION_ACTIONS.map(action => (
                <th
                  key={`${category}-${action}`}
                  className="border-l border-gray-50 px-0 py-1 text-center font-normal first:border-l-gray-100"
                  title={t(`matrix.actions.${action}`)}
                >
                  {t(`matrix.actionsShort.${action}`)}
                </th>
              )),
            )}
            <th className="border-l border-gray-100" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {departments.map(dept => {
            const permissions =
              draftPermissions[dept.bitrixDepartmentId] ?? dept.permissions
            const dirty = isDirty(dept, draftPermissions)

            return (
              <tr
                key={dept.bitrixDepartmentId}
                className="hover:bg-slate-50/50"
              >
                <td className="sticky left-0 z-10 bg-white px-3 py-2 hover:bg-slate-50/50">
                  <p className="truncate font-medium text-slate-800">
                    {dept.displayName ??
                      `Departamento #${dept.bitrixDepartmentId}`}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">
                    ID {dept.bitrixDepartmentId}
                  </p>
                </td>
                {THINKZAP_PERMISSION_CATEGORIES.map(category =>
                  THINKZAP_PERMISSION_ACTIONS.map(action => (
                    <td
                      key={`${dept.bitrixDepartmentId}-${category}-${action}`}
                      className="border-l border-gray-50 px-0 py-2 text-center first:border-l-gray-100"
                    >
                      <label className="cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions[category][action]}
                          onChange={() =>
                            onPermissionChange(
                              dept.bitrixDepartmentId,
                              category,
                              action,
                            )
                          }
                          className="h-3.5 w-3.5 rounded border-gray-300 text-[#5A997E] focus:ring-[#5A997E]"
                        />
                      </label>
                    </td>
                  )),
                )}
                <td className="border-l border-gray-100 px-2 py-2">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      title={t('savePermissions')}
                      disabled={!dirty || savingId === dept.bitrixDepartmentId}
                      onClick={() => onSave(dept.bitrixDepartmentId)}
                      className="rounded p-1 text-[#5A997E] hover:bg-[#5A997E]/10 disabled:opacity-30"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      title={t('remove')}
                      disabled={removingId === dept.bitrixDepartmentId}
                      onClick={() => onRemove(dept.bitrixDepartmentId)}
                      className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-30"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
