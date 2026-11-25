'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { PlusIcon, ShieldCheckIcon } from 'lucide-react'
import { isBitrixAdmin } from '@/bitrix'
import { useThinkzapAccess } from '@/app/hooks/use-thinkzap-permissions'
import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
  type ThinkzapHttpClient,
} from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'
import { Button } from '@/components/ui/button'
import { useAplicationContext } from '@/providers/aplication-provider'
import { listSendableLines } from '@/shared/aplication/subscription-items'
import type {
  AccessGroup,
  PortalDepartment,
  toGroupPayload,
} from '@/shared/thinkzap/access-group-draft'
import { AccessGroupCard, type PortalUser } from './access-group-card'
import { AccessGroupSheet } from './access-group-sheet'

/** `null` = painel fechado; `'new'` = criando; senão, o grupo em edição. */
type Editing = null | 'new' | AccessGroup

/** Ids por consulta de nomes, para a URL não estourar o limite do proxy. */
const USER_IDS_PER_REQUEST = 200

async function fetchUsersByIds(
  client: ThinkzapHttpClient,
  ids: string[],
): Promise<PortalUser[]> {
  const requests = []
  for (let i = 0; i < ids.length; i += USER_IDS_PER_REQUEST) {
    requests.push(
      client.get<{ users: PortalUser[] }>('/thinkzap/portal-users', {
        params: { ids: ids.slice(i, i + USER_IDS_PER_REQUEST).join(',') },
      }),
    )
  }
  const pages = await Promise.all(requests)
  return pages.flatMap(page => page.users ?? [])
}

/**
 * Grupos de acesso do widget: quais linhas cada grupo de pessoas e departamentos pode
 * usar.
 *
 * Sem nenhum grupo, todos usam todas as linhas; com ao menos um, quem não pertence a
 * nenhum fica sem linha — por isso o aviso ao criar o primeiro grupo.
 *
 * As linhas oferecidas vêm do contexto da aplicação (as mesmas do widget).
 */
export function GruposAcessoSection() {
  const { t } = useTranslation('thinkzap/grupos-acesso')
  const thinkzapAccess = useThinkzapAccess()
  const { state: aplicationState } = useAplicationContext()
  const canManage = thinkzapAccess?.canManageAccess === true || isBitrixAdmin()

  const [groups, setGroups] = useState<AccessGroup[]>([])
  const [users, setUsers] = useState<ReadonlyMap<string, PortalUser>>(new Map())
  const [departments, setDepartments] = useState<PortalDepartment[] | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState<Editing>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState('')

  const lines = useMemo(
    () =>
      aplicationState.status === 'ready'
        ? listSendableLines(aplicationState.subscriptions, new Date())
        : [],
    [aplicationState],
  )
  const lineNameById = useMemo(
    () => new Map(lines.map(line => [line.id, line.name])),
    [lines],
  )

  const getClient = useCallback((): ThinkzapHttpClient | null => {
    const resolved = resolveThinkzapClient()
    return resolved.ok ? resolved.client : null
  }, [])

  const rememberUsers = useCallback((found: PortalUser[]) => {
    setUsers(previous => {
      const next = new Map(previous)
      // A busca não informa `active`: não pode apagar o que a consulta por id trouxe.
      for (const user of found) {
        next.set(user.id, { ...next.get(user.id), ...user })
      }
      return next
    })
  }, [])

  const loadDepartments = useCallback(async () => {
    const client = getClient()
    if (!client) return
    try {
      const data = await client.get<{ departments: PortalDepartment[] }>(
        '/thinkzap/portal-departments',
      )
      setDepartments(data.departments ?? [])
    } catch {
      // Sem a lista, o resto da tela segue e os vínculos gravados são mantidos.
      setDepartments(null)
    }
  }, [getClient])

  const load = useCallback(async () => {
    const client = getClient()
    if (!client) {
      setLoadFailed(true)
      setLoading(false)
      return
    }
    try {
      const data = await client.get<{ groups: AccessGroup[] }>(
        '/thinkzap/access/groups',
      )
      const list = data.groups ?? []
      const memberIds = [...new Set(list.flatMap(group => group.memberIds))]
      try {
        rememberUsers(await fetchUsersByIds(client, memberIds))
      } catch (error) {
        toast.error(thinkzapApiErrorMessage(error, t('usersError')))
      }
      setGroups(list)
      setLoadFailed(false)
    } catch (error) {
      setLoadFailed(true)
      toast.error(thinkzapApiErrorMessage(error, t('loadError')))
    } finally {
      setLoading(false)
    }
  }, [getClient, rememberUsers, t])

  useEffect(() => {
    if (!canManage) return
    void load()
    void loadDepartments()
  }, [canManage, load, loadDepartments])

  async function handleSave(payload: ReturnType<typeof toGroupPayload>) {
    const client = getClient()
    if (!client || editing === null) throw new Error(t('saveError'))
    if (editing === 'new') {
      await client.post('/thinkzap/access/groups', payload)
    } else {
      await client.put(`/thinkzap/access/groups/${editing.id}`, payload)
    }
    toast.success(t('saved'))
    setEditing(null)
    await load()
  }

  async function handleDelete(group: AccessGroup) {
    const client = getClient()
    if (!client) return
    setDeleting(true)
    try {
      await client.delete(`/thinkzap/access/groups/${group.id}`)
      toast.success(t('deleted'))
      setConfirmingDeleteId('')
      await load()
    } catch (error) {
      toast.error(thinkzapApiErrorMessage(error, t('deleteError')))
    } finally {
      setDeleting(false)
    }
  }

  if (!canManage) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {t('adminOnly')}
      </p>
    )
  }

  function openEditor(target: Editing) {
    setConfirmingDeleteId('')
    setEditing(target)
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheckIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t('pageTitle')}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t('pageDescription')}
            </p>
          </div>
        </div>
        {groups.length > 0 ? (
          <Button onClick={() => openEditor('new')}>
            <PlusIcon />
            {t('newGroup')}
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-16" role="status">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <span className="sr-only">{t('loading')}</span>
        </div>
      ) : loadFailed && groups.length === 0 ? (
        // Falha não pode parecer "nenhum grupo", que significa acesso liberado.
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
          <p>{t('loadError')}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t('retry')}
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-4 py-12 text-center">
          <p className="max-w-md text-sm text-muted-foreground">{t('empty')}</p>
          <Button onClick={() => openEditor('new')}>
            <PlusIcon />
            {t('newGroup')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map(group => (
            <AccessGroupCard
              key={group.id}
              group={group}
              users={users}
              departments={departments}
              lineNameById={lineNameById}
              confirmingDelete={confirmingDeleteId === group.id}
              busy={deleting}
              onEdit={() => openEditor(group)}
              onAskDelete={() => setConfirmingDeleteId(group.id)}
              onCancelDelete={() => setConfirmingDeleteId('')}
              onDelete={() => void handleDelete(group)}
            />
          ))}
        </div>
      )}

      {editing !== null ? (
        <AccessGroupSheet
          group={editing === 'new' ? null : editing}
          isFirstGroup={editing === 'new' && groups.length === 0}
          lines={lines}
          users={users}
          departments={departments}
          onUserPicked={user => rememberUsers([user])}
          onRetryDepartments={() => void loadDepartments()}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}
