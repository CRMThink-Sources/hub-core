'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { PermissionsHeader } from '../_components/permissions-header'
import {
  PermissionsModeTabs,
  type PermissionsTabMode,
} from '../_components/permissions-mode-tabs'
import { PermissionsToolbar } from '../_components/permissions-toolbar'
import { PermissionsAddDialog } from '../_components/permissions-add-dialog'
import { PermissionsFooterBar } from '../_components/permissions-footer-bar'
import { PermissionsUsersTable } from '../_components/permissions-users-table'
import { PermissionsDepartmentsTable } from '../_components/permissions-departments-table'
import {
  DEFAULT_ALLOWED_USER_PERMISSIONS,
  THINKZAP_PERMISSION_CATEGORIES,
  type ThinkzapPermissionAction,
  type ThinkzapUserPermissions,
} from '@/shared/thinkzap-permissions'

const PAGE_SIZE = 10

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

function isUserDirty(
  user: AllowedUser,
  draft: Record<string, ThinkzapUserPermissions>,
): boolean {
  const current = draft[user.bitrixUserId]
  if (!current) return false
  return JSON.stringify(current) !== JSON.stringify(user.permissions)
}

function isDeptDirty(
  dept: AllowedDepartment,
  draft: Record<string, ThinkzapUserPermissions>,
): boolean {
  const current = draft[dept.bitrixDepartmentId]
  if (!current) return false
  return JSON.stringify(current) !== JSON.stringify(dept.permissions)
}

export default function PermissoesPage() {
  const { t } = useTranslation('thinkzap/permissoes')
  const { session } = useSession()
  const api = useThinkzapApi()
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const { ready: bx24Ready } = useBX24(scriptLoaded)

  const [activeTab, setActiveTab] = useState<PermissionsTabMode>('users')
  const [tableFilter, setTableFilter] = useState('')
  const [page, setPage] = useState(1)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [savingAll, setSavingAll] = useState(false)

  const [users, setUsers] = useState<AllowedUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [addUserQuery, setAddUserQuery] = useState('')
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [userHits, setUserHits] = useState<BitrixUserSearchHit[]>([])
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [newUserPermissions, setNewUserPermissions] =
    useState<ThinkzapUserPermissions>(DEFAULT_ALLOWED_USER_PERMISSIONS)
  const [draftUserPermissions, setDraftUserPermissions] = useState<
    Record<string, ThinkzapUserPermissions>
  >({})

  const [departments, setDepartments] = useState<AllowedDepartment[]>([])
  const [loadingDepts, setLoadingDepts] = useState(true)
  const [addDeptQuery, setAddDeptQuery] = useState('')
  const [searchingDepts, setSearchingDepts] = useState(false)
  const [deptHits, setDeptHits] = useState<BitrixDepartmentHit[]>([])
  const [removingDeptId, setRemovingDeptId] = useState<string | null>(null)
  const [newDeptPermissions, setNewDeptPermissions] =
    useState<ThinkzapUserPermissions>(DEFAULT_ALLOWED_USER_PERMISSIONS)
  const [draftDeptPermissions, setDraftDeptPermissions] = useState<
    Record<string, ThinkzapUserPermissions>
  >({})

  const canManage =
    session?.thinkzapAccess?.canManageAccess === true || isBitrixAdmin()

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const data = await api.get<{ users: AllowedUser[] }>(
        '/thinkzap/access/allowed-users',
      )
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

  const loadDepartments = useCallback(async () => {
    setLoadingDepts(true)
    try {
      const data = await api.get<{ departments: AllowedDepartment[] }>(
        '/thinkzap/access/allowed-departments',
      )
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

  useEffect(() => {
    setPage(1)
  }, [activeTab, tableFilter])

  useEffect(() => {
    if (!addDialogOpen || !bx24Ready || activeTab !== 'users') {
      if (!addDialogOpen) setUserHits([])
      return
    }
    if (addUserQuery.trim().length < 2) {
      setUserHits([])
      return
    }
    const handle = window.setTimeout(() => {
      setSearchingUsers(true)
      searchBitrixUsers(addUserQuery.trim())
        .then(hits => setUserHits(hits.slice(0, 6)))
        .catch(() => setUserHits([]))
        .finally(() => setSearchingUsers(false))
    }, 350)
    return () => window.clearTimeout(handle)
  }, [addDialogOpen, bx24Ready, activeTab, addUserQuery])

  useEffect(() => {
    if (!addDialogOpen || !bx24Ready || activeTab !== 'departments') {
      if (!addDialogOpen) setDeptHits([])
      return
    }
    const trimmed = addDeptQuery.trim()
    const handle = window.setTimeout(() => {
      setSearchingDepts(true)
      searchBitrixDepartments(trimmed.length > 0 ? trimmed : undefined)
        .then(hits => setDeptHits(hits.slice(0, 8)))
        .catch(() => setDeptHits([]))
        .finally(() => setSearchingDepts(false))
    }, 350)
    return () => window.clearTimeout(handle)
  }, [addDialogOpen, bx24Ready, activeTab, addDeptQuery])

  const filteredUsers = useMemo(() => {
    const q = tableFilter.trim().toLowerCase()
    if (!q) return users
    return users.filter(u => {
      const name = (u.displayName ?? '').toLowerCase()
      const email = (u.email ?? '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [users, tableFilter])

  const filteredDepartments = useMemo(() => {
    const q = tableFilter.trim().toLowerCase()
    if (!q) return departments
    return departments.filter(d =>
      (d.displayName ?? '').toLowerCase().includes(q),
    )
  }, [departments, tableFilter])

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredUsers.slice(start, start + PAGE_SIZE)
  }, [filteredUsers, page])

  const paginatedDepartments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredDepartments.slice(start, start + PAGE_SIZE)
  }, [filteredDepartments, page])

  const dirtyUserIds = useMemo(
    () =>
      users
        .filter(u => isUserDirty(u, draftUserPermissions))
        .map(u => u.bitrixUserId),
    [users, draftUserPermissions],
  )

  const dirtyDeptIds = useMemo(
    () =>
      departments
        .filter(d => isDeptDirty(d, draftDeptPermissions))
        .map(d => d.bitrixDepartmentId),
    [departments, draftDeptPermissions],
  )

  const dirtyCount =
    activeTab === 'users' ? dirtyUserIds.length : dirtyDeptIds.length

  function openAddDialog() {
    setAddDialogOpen(true)
    if (activeTab === 'users') {
      setAddUserQuery('')
      setUserHits([])
    } else {
      setAddDeptQuery('')
      setDeptHits([])
    }
  }

  function closeAddDialog() {
    setAddDialogOpen(false)
    setAddUserQuery('')
    setAddDeptQuery('')
    setUserHits([])
    setDeptHits([])
  }

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
      closeAddDialog()
      await loadUsers()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveError'))
    }
  }

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
      closeAddDialog()
      await loadDepartments()
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

  async function handleSaveAll() {
    setSavingAll(true)
    try {
      if (activeTab === 'users') {
        await Promise.all(
          dirtyUserIds.map(bitrixUserId =>
            api.patch(`/thinkzap/access/allowed-users/${bitrixUserId}`, {
              permissions: draftUserPermissions[bitrixUserId],
            }),
          ),
        )
        await loadUsers()
      } else {
        await Promise.all(
          dirtyDeptIds.map(bitrixDepartmentId =>
            api.patch(
              `/thinkzap/access/allowed-departments/${bitrixDepartmentId}`,
              { permissions: draftDeptPermissions[bitrixDepartmentId] },
            ),
          ),
        )
        await loadDepartments()
      }
      toast.success(t('permissionsSaved'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveError'))
    } finally {
      setSavingAll(false)
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

  const addDialogHits =
    activeTab === 'users'
      ? userHits.map(hit => ({
          id: hit.ID,
          primary: formatBitrixUserName(hit),
          secondary: hit.EMAIL ?? `ID ${hit.ID}`,
        }))
      : deptHits.map(hit => ({
          id: hit.ID,
          primary: formatBitrixDepartmentName(hit),
          secondary: `ID ${hit.ID}`,
        }))

  if (!canManage) {
    return (
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('adminOnly')}
        </p>
      </div>
    )
  }

  const isLoading = activeTab === 'users' ? loadingUsers : loadingDepts
  const isEmpty =
    activeTab === 'users'
      ? filteredUsers.length === 0
      : filteredDepartments.length === 0

  return (
    <div className="relative mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 pb-4 pt-6 sm:px-6 lg:px-8">
      <BX24Script onLoad={() => setScriptLoaded(true)} />

      <PermissionsHeader />
      <PermissionsModeTabs activeTab={activeTab} onChange={setActiveTab} />

      <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
        <PermissionsToolbar
          mode={activeTab}
          filter={tableFilter}
          onFilterChange={setTableFilter}
          onAddClick={openAddDialog}
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : isEmpty ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
            {activeTab === 'users'
              ? t('emptyList')
              : t('departments.emptyList')}
          </p>
        ) : activeTab === 'users' ? (
          <PermissionsUsersTable
            users={paginatedUsers}
            totalCount={filteredUsers.length}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            draftPermissions={draftUserPermissions}
            onPermissionChange={handleUserPermissionChange}
            onRemove={bitrixUserId => void handleRemoveUser(bitrixUserId)}
            removingId={removingUserId}
          />
        ) : (
          <PermissionsDepartmentsTable
            departments={paginatedDepartments}
            totalCount={filteredDepartments.length}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            draftPermissions={draftDeptPermissions}
            onPermissionChange={handleDeptPermissionChange}
            onRemove={id => void handleRemoveDepartment(id)}
            removingId={removingDeptId}
          />
        )}
      </div>

      <PermissionsFooterBar
        dirtyCount={dirtyCount}
        saving={savingAll}
        onSave={() => void handleSaveAll()}
      />

      <PermissionsAddDialog
        mode={activeTab}
        isOpen={addDialogOpen}
        query={activeTab === 'users' ? addUserQuery : addDeptQuery}
        searching={activeTab === 'users' ? searchingUsers : searchingDepts}
        hits={addDialogHits}
        onClose={closeAddDialog}
        onQueryChange={
          activeTab === 'users' ? setAddUserQuery : setAddDeptQuery
        }
        onSelect={hit => {
          if (activeTab === 'users') {
            const userHit = userHits.find(h => String(h.ID) === String(hit.id))
            if (userHit) void handleAddUser(userHit)
          } else {
            const deptHit = deptHits.find(h => String(h.ID) === String(hit.id))
            if (deptHit) void handleAddDepartment(deptHit)
          }
        }}
      />
    </div>
  )
}
