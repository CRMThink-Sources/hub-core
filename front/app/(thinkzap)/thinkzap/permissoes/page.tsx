'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  BX24Script,
  formatBitrixUserName,
  formatBitrixDepartmentName,
  isBitrixAdmin,
  searchBitrixUsers,
  searchBitrixDepartments,
  useBX24,
  type BitrixUserSearchHit,
  type BitrixDepartmentHit,
} from '@/bitrix'
import { useThinkzapApi } from '@/app/hooks/use-thinkzap-api'
import { useSession } from '@/providers/session-provider'
import { PermissionsMatrix } from '../_components/permissions-matrix'
import { PermissionsUsersTable } from '../_components/permissions-users-table'
import { PermissionsDepartmentsTable } from '../_components/permissions-departments-table'
import {
  DEFAULT_ALLOWED_USER_PERMISSIONS,
  THINKZAP_PERMISSION_CATEGORIES,
  type ThinkzapPermissionAction,
  type ThinkzapUserPermissions,
} from '@/shared/thinkzap-permissions'

type AllowedUser = {
  id: string
  bitrixUserId: string
  displayName: string | null
  email: string | null
  permissions: ThinkzapUserPermissions
}

type AllowedDepartment = {
  id: string
  bitrixDepartmentId: string
  displayName: string | null
  permissions: ThinkzapUserPermissions
}

export default function PermissoesPage() {
  const { t } = useTranslation('thinkzap/permissoes')
  const { session } = useSession()
  const api = useThinkzapApi()
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const { ready: bx24Ready } = useBX24(scriptLoaded)

  // --- Users state ---
  const [users, setUsers] = useState<AllowedUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [userQuery, setUserQuery] = useState('')
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [userHits, setUserHits] = useState<BitrixUserSearchHit[]>([])
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [newUserPermissions, setNewUserPermissions] =
    useState<ThinkzapUserPermissions>(DEFAULT_ALLOWED_USER_PERMISSIONS)
  const [draftUserPermissions, setDraftUserPermissions] = useState<
    Record<string, ThinkzapUserPermissions>
  >({})
  const [savingUserId, setSavingUserId] = useState<string | null>(null)

  // --- Departments state ---
  const [departments, setDepartments] = useState<AllowedDepartment[]>([])
  const [loadingDepts, setLoadingDepts] = useState(true)
  const [deptQuery, setDeptQuery] = useState('')
  const [searchingDepts, setSearchingDepts] = useState(false)
  const [deptHits, setDeptHits] = useState<BitrixDepartmentHit[]>([])
  const [removingDeptId, setRemovingDeptId] = useState<string | null>(null)
  const [newDeptPermissions, setNewDeptPermissions] =
    useState<ThinkzapUserPermissions>(DEFAULT_ALLOWED_USER_PERMISSIONS)
  const [draftDeptPermissions, setDraftDeptPermissions] = useState<
    Record<string, ThinkzapUserPermissions>
  >({})
  const [savingDeptId, setSavingDeptId] = useState<string | null>(null)

  const canManage =
    session?.thinkzapAccess?.canManageAccess === true || isBitrixAdmin()

  // --- Load users ---
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const data = await api.get('/thinkzap/access/allowed-users')
      const list = data.users ?? []
      setUsers(list)
      setDraftUserPermissions(
        Object.fromEntries(list.map(u => [u.bitrixUserId, u.permissions])),
      )
    } catch {
      toast.error(t('loadError'))
    } finally {
      setLoadingUsers(false)
    }
  }, [api, t])

  // --- Load departments ---
  const loadDepartments = useCallback(async () => {
    setLoadingDepts(true)
    try {
      const data = await api.get('/thinkzap/access/allowed-departments')
      const list = data.departments ?? []
      setDepartments(list)
      setDraftDeptPermissions(
        Object.fromEntries(
          list.map(d => [d.bitrixDepartmentId, d.permissions]),
        ),
      )
    } catch {
      toast.error(t('loadError'))
    } finally {
      setLoadingDepts(false)
    }
  }, [api, t])

  useEffect(() => {
    if (canManage) {
      void loadUsers()
      void loadDepartments()
    } else {
      setLoadingUsers(false)
      setLoadingDepts(false)
    }
  }, [canManage, loadUsers, loadDepartments])

  // --- User search ---
  useEffect(() => {
    if (!bx24Ready || userQuery.trim().length < 2) {
      setUserHits([])
      return
    }
    const handle = window.setTimeout(() => {
      setSearchingUsers(true)
      searchBitrixUsers(userQuery.trim())
        .then(hits => setUserHits(hits.slice(0, 6)))
        .catch(() => setUserHits([]))
        .finally(() => setSearchingUsers(false))
    }, 350)
    return () => window.clearTimeout(handle)
  }, [bx24Ready, userQuery])

  // --- Department search ---
  useEffect(() => {
    if (!bx24Ready) {
      setDeptHits([])
      return
    }
    const trimmed = deptQuery.trim()
    const handle = window.setTimeout(() => {
      setSearchingDepts(true)
      searchBitrixDepartments(trimmed.length > 0 ? trimmed : undefined)
        .then(hits => setDeptHits(hits.slice(0, 8)))
        .catch(() => setDeptHits([]))
        .finally(() => setSearchingDepts(false))
    }, 350)
    return () => window.clearTimeout(handle)
  }, [bx24Ready, deptQuery])

  // --- User actions ---
  async function handleAddUser(hit: BitrixUserSearchHit) {
    const bitrixUserId = String(hit.ID)
    if (users.some(u => u.bitrixUserId === bitrixUserId)) {
      toast.error(t('alreadyOnList'))
      return
    }
    try {
      await api.post('/thinkzap/access/allowed-users', {
        bitrixUserId,
        displayName: formatBitrixUserName(hit),
        email: hit.EMAIL ?? null,
        permissions: newUserPermissions,
      })
      toast.success(t('added'))
      setUserQuery('')
      setUserHits([])
      setNewUserPermissions(DEFAULT_ALLOWED_USER_PERMISSIONS)
      await loadUsers()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveError'))
    }
  }

  function handleUserPermissionChange(
    bitrixUserId: string,
    category: (typeof THINKZAP_PERMISSION_CATEGORIES)[number],
    action: ThinkzapPermissionAction,
  ) {
    setDraftUserPermissions(prev => {
      const current = prev[bitrixUserId]
      if (!current) return prev
      return {
        ...prev,
        [bitrixUserId]: {
          ...current,
          [category]: {
            ...current[category],
            [action]: !current[category][action],
          },
        },
      }
    })
  }

  async function handleSaveUserPermissions(bitrixUserId: string) {
    const permissions = draftUserPermissions[bitrixUserId]
    if (!permissions) return
    setSavingUserId(bitrixUserId)
    try {
      await api.patch(`/thinkzap/access/allowed-users/${bitrixUserId}`, {
        permissions,
      })
      toast.success(t('permissionsSaved'))
      await loadUsers()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveError'))
    } finally {
      setSavingUserId(null)
    }
  }

  async function handleRemoveUser(bitrixUserId: string) {
    if (!window.confirm(t('removeConfirm'))) return
    setRemovingUserId(bitrixUserId)
    try {
      await api.delete(`/thinkzap/access/allowed-users/${bitrixUserId}`)
      toast.success(t('removed'))
      await loadUsers()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveError'))
    } finally {
      setRemovingUserId(null)
    }
  }

  // --- Department actions ---
  async function handleAddDepartment(hit: BitrixDepartmentHit) {
    const bitrixDepartmentId = String(hit.ID)
    if (departments.some(d => d.bitrixDepartmentId === bitrixDepartmentId)) {
      toast.error(t('departments.alreadyOnList'))
      return
    }
    try {
      await api.post('/thinkzap/access/allowed-departments', {
        bitrixDepartmentId,
        displayName: formatBitrixDepartmentName(hit),
        permissions: newDeptPermissions,
      })
      toast.success(t('departments.added'))
      setDeptQuery('')
      setDeptHits([])
      setNewDeptPermissions(DEFAULT_ALLOWED_USER_PERMISSIONS)
      await loadDepartments()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveError'))
    }
  }

  function handleDeptPermissionChange(
    bitrixDepartmentId: string,
    category: (typeof THINKZAP_PERMISSION_CATEGORIES)[number],
    action: ThinkzapPermissionAction,
  ) {
    setDraftDeptPermissions(prev => {
      const current = prev[bitrixDepartmentId]
      if (!current) return prev
      return {
        ...prev,
        [bitrixDepartmentId]: {
          ...current,
          [category]: {
            ...current[category],
            [action]: !current[category][action],
          },
        },
      }
    })
  }

  async function handleSaveDeptPermissions(bitrixDepartmentId: string) {
    const permissions = draftDeptPermissions[bitrixDepartmentId]
    if (!permissions) return
    setSavingDeptId(bitrixDepartmentId)
    try {
      await api.patch(
        `/thinkzap/access/allowed-departments/${bitrixDepartmentId}`,
        { permissions },
      )
      toast.success(t('permissionsSaved'))
      await loadDepartments()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveError'))
    } finally {
      setSavingDeptId(null)
    }
  }

  async function handleRemoveDepartment(bitrixDepartmentId: string) {
    if (!window.confirm(t('departments.removeConfirm'))) return
    setRemovingDeptId(bitrixDepartmentId)
    try {
      await api.delete(
        `/thinkzap/access/allowed-departments/${bitrixDepartmentId}`,
      )
      toast.success(t('departments.removed'))
      await loadDepartments()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveError'))
    } finally {
      setRemovingDeptId(null)
    }
  }

  if (!canManage) {
    return (
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('adminOnly')}
        </p>
      </div>
    )
  }

  return (
    <div className="relative mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-4 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <BX24Script onLoad={() => setScriptLoaded(true)} />

      <div className="flex flex-col gap-1 rounded-lg border border-gray-100 bg-white px-4 py-3">
        <h1 className="page-title text-lg">{t('pageTitle')}</h1>
        <p className="text-xs text-slate-500">{t('pageDescription')}</p>
      </div>

      {/* ---- USERS SECTION ---- */}
      <div className="flex flex-col gap-1 rounded-lg border border-gray-100 bg-white px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">
          {t('users.sectionTitle')}
        </h2>
        <p className="text-xs text-slate-400">
          {t('users.sectionDescription')}
        </p>
      </div>

      <div className="rounded-lg border border-gray-100 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('addUser')}
            </label>
            <input
              type="search"
              value={userQuery}
              onChange={e => setUserQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#5A997E] focus:ring-1 focus:ring-[#5A997E]"
            />
          </div>
        </div>

        {(searchingUsers || userHits.length > 0) && (
          <ul className="mt-2 divide-y divide-gray-50 rounded-md border border-gray-100">
            {searchingUsers && (
              <li className="px-3 py-2 text-xs text-slate-400">
                {t('searching')}
              </li>
            )}
            {!searchingUsers &&
              userHits.map(hit => (
                <li
                  key={hit.ID}
                  className="flex items-center justify-between gap-2 px-3 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {formatBitrixUserName(hit)}
                    </p>
                    <p className="truncate text-[10px] text-slate-400">
                      {hit.EMAIL ?? `ID ${hit.ID}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleAddUser(hit)}
                    className="shrink-0 rounded-md bg-[#5A997E] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
                  >
                    +
                  </button>
                </li>
              ))}
          </ul>
        )}

        <div className="mt-3 border-t border-gray-50 pt-3">
          <p className="mb-2 text-[11px] font-medium text-slate-500">
            {t('defaultPermissionsForNewUser')}
          </p>
          <PermissionsMatrix
            inline
            value={newUserPermissions}
            onChange={setNewUserPermissions}
          />
        </div>
      </div>

      {loadingUsers ? (
        <div className="flex items-center justify-center rounded-lg border border-gray-100 bg-white py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-[#5A997E]" />
        </div>
      ) : users.length === 0 ? (
        <p className="rounded-lg border border-gray-100 bg-white px-4 py-8 text-center text-xs text-slate-500">
          {t('emptyList')}
        </p>
      ) : (
        <PermissionsUsersTable
          users={users}
          draftPermissions={draftUserPermissions}
          onPermissionChange={handleUserPermissionChange}
          onSave={bitrixUserId => void handleSaveUserPermissions(bitrixUserId)}
          onRemove={bitrixUserId => void handleRemoveUser(bitrixUserId)}
          savingId={savingUserId}
          removingId={removingUserId}
        />
      )}

      {/* ---- DEPARTMENTS SECTION ---- */}
      <div className="flex flex-col gap-1 rounded-lg border border-gray-100 bg-white px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">
          {t('departments.sectionTitle')}
        </h2>
        <p className="text-xs text-slate-400">
          {t('departments.sectionDescription')}
        </p>
      </div>

      <div className="rounded-lg border border-gray-100 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('departments.addDepartment')}
            </label>
            <input
              type="search"
              value={deptQuery}
              onChange={e => setDeptQuery(e.target.value)}
              placeholder={t('departments.searchPlaceholder')}
              className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#5A997E] focus:ring-1 focus:ring-[#5A997E]"
            />
          </div>
        </div>

        {(searchingDepts || deptHits.length > 0) && (
          <ul className="mt-2 divide-y divide-gray-50 rounded-md border border-gray-100">
            {searchingDepts && (
              <li className="px-3 py-2 text-xs text-slate-400">
                {t('searching')}
              </li>
            )}
            {!searchingDepts &&
              deptHits.map(hit => (
                <li
                  key={hit.ID}
                  className="flex items-center justify-between gap-2 px-3 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {formatBitrixDepartmentName(hit)}
                    </p>
                    <p className="truncate text-[10px] text-slate-400">
                      ID {hit.ID}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleAddDepartment(hit)}
                    className="shrink-0 rounded-md bg-[#5A997E] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
                  >
                    +
                  </button>
                </li>
              ))}
          </ul>
        )}

        <div className="mt-3 border-t border-gray-50 pt-3">
          <p className="mb-2 text-[11px] font-medium text-slate-500">
            {t('departments.defaultPermissionsForNewDepartment')}
          </p>
          <PermissionsMatrix
            inline
            value={newDeptPermissions}
            onChange={setNewDeptPermissions}
          />
        </div>
      </div>

      {loadingDepts ? (
        <div className="flex items-center justify-center rounded-lg border border-gray-100 bg-white py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-[#5A997E]" />
        </div>
      ) : departments.length === 0 ? (
        <p className="rounded-lg border border-gray-100 bg-white px-4 py-8 text-center text-xs text-slate-500">
          {t('departments.emptyList')}
        </p>
      ) : (
        <PermissionsDepartmentsTable
          departments={departments}
          draftPermissions={draftDeptPermissions}
          onPermissionChange={handleDeptPermissionChange}
          onSave={id => void handleSaveDeptPermissions(id)}
          onRemove={id => void handleRemoveDepartment(id)}
          savingId={savingDeptId}
          removingId={removingDeptId}
        />
      )}

      <p className="text-[10px] text-slate-400">{t('legend')}</p>
    </div>
  )
}
