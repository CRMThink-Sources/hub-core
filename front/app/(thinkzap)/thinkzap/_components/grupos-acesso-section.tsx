'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { PlusIcon, SearchIcon, ShieldCheckIcon } from 'lucide-react'
import { isBitrixAdmin } from '@/bitrix'
import { useThinkzapAccess } from '@/app/hooks/use-thinkzap-permissions'
import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
  type ThinkzapHttpClient,
} from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAplicationContext } from '@/providers/aplication-provider'
import { listSendableLines } from '@/shared/aplication/subscription-items'

type PortalUser = { id: string; name: string; position?: string }

type AccessGroup = {
  id: string
  name: string
  memberIds: string[]
  lineIds: string[]
}

/** `null` = lista; `'new'` = criando; senão, o grupo em edição. */
type Editing = null | 'new' | AccessGroup

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id]
}

function CheckList(props: {
  items: Array<{ id: string; label: string; hint?: string }>
  selected: string[]
  onToggle: (id: string) => void
  empty: string
}) {
  if (props.items.length === 0) {
    return (
      <p className="rounded-lg border border-border px-3 py-6 text-center text-sm text-muted-foreground">
        {props.empty}
      </p>
    )
  }
  return (
    <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
      {props.items.map(item => (
        <label
          key={item.id}
          className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0 hover:bg-accent"
        >
          <input
            type="checkbox"
            checked={props.selected.includes(item.id)}
            onChange={() => props.onToggle(item.id)}
            className="size-4"
          />
          <span className="min-w-0 flex-1 truncate text-foreground">
            {item.label}
          </span>
          {item.hint ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {item.hint}
            </span>
          ) : null}
        </label>
      ))}
    </div>
  )
}

/**
 * Grupos de acesso do widget: quais linhas cada grupo de usuários pode usar.
 *
 * Sem nenhum grupo, todos usam todas as linhas; com ao menos um, quem não está em
 * nenhum grupo fica sem linha — por isso o aviso ao criar o primeiro grupo.
 *
 * As linhas oferecidas vêm do contexto da aplicação (as mesmas do widget). Vínculo
 * com linha que não está entre as oferecidas (bloqueada, sem provider, assinatura
 * vencida ou excluída) não aparece aqui, mas é **preservado** no salvamento: sumir da
 * lista por um estado passageiro não pode apagar o vínculo.
 */
export function GruposAcessoSection() {
  const { t } = useTranslation('thinkzap/grupos-acesso')
  const thinkzapAccess = useThinkzapAccess()
  const { state: aplicationState } = useAplicationContext()
  const canManage = thinkzapAccess?.canManageAccess === true || isBitrixAdmin()

  const [groups, setGroups] = useState<AccessGroup[]>([])
  const [users, setUsers] = useState<PortalUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Editing>(null)
  const [name, setName] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [lineIds, setLineIds] = useState<string[]>([])
  const [hiddenLineIds, setHiddenLineIds] = useState<string[]>([])
  const [userFilter, setUserFilter] = useState('')
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
  const userNameById = useMemo(
    () => new Map(users.map(user => [user.id, user.name])),
    [users],
  )

  const getClient = useCallback((): ThinkzapHttpClient | null => {
    const resolved = resolveThinkzapClient()
    return resolved.ok ? resolved.client : null
  }, [])

  const load = useCallback(async () => {
    const client = getClient()
    if (!client) {
      toast.error(t('loadError'))
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [groupsData, usersData] = await Promise.all([
        client.get<{ groups: AccessGroup[] }>('/thinkzap/access/groups'),
        client.get<{ users: PortalUser[] }>('/thinkzap/portal-users'),
      ])
      setGroups(groupsData.groups ?? [])
      setUsers(usersData.users ?? [])
    } catch (error) {
      toast.error(thinkzapApiErrorMessage(error, t('loadError')))
    } finally {
      setLoading(false)
    }
  }, [getClient, t])

  useEffect(() => {
    if (!canManage) return
    void load()
  }, [canManage, load])

  function openEditor(group: Editing) {
    setEditing(group)
    setConfirmingDeleteId('')
    setUserFilter('')
    if (group && group !== 'new') {
      setName(group.name)
      setMemberIds(group.memberIds)
      setLineIds(group.lineIds.filter(id => lineNameById.has(id)))
      setHiddenLineIds(group.lineIds.filter(id => !lineNameById.has(id)))
    } else {
      setName('')
      setMemberIds([])
      setLineIds([])
      setHiddenLineIds([])
    }
  }

  async function handleSave() {
    const client = getClient()
    if (!client || editing === null) return
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(t('nameRequired'))
      return
    }
    setSaving(true)
    try {
      const body = {
        name: trimmed,
        memberIds,
        lineIds: [...lineIds, ...hiddenLineIds],
      }
      if (editing === 'new') {
        await client.post('/thinkzap/access/groups', body)
      } else {
        await client.put(`/thinkzap/access/groups/${editing.id}`, body)
      }
      toast.success(t('saved'))
      setEditing(null)
      await load()
    } catch (error) {
      toast.error(thinkzapApiErrorMessage(error, t('saveError')))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(group: AccessGroup) {
    const client = getClient()
    if (!client) return
    setSaving(true)
    try {
      await client.delete(`/thinkzap/access/groups/${group.id}`)
      toast.success(t('deleted'))
      setConfirmingDeleteId('')
      await load()
    } catch (error) {
      toast.error(thinkzapApiErrorMessage(error, t('deleteError')))
    } finally {
      setSaving(false)
    }
  }

  if (!canManage) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {t('adminOnly')}
      </p>
    )
  }

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(userFilter.trim().toLowerCase()),
  )

  if (editing !== null) {
    const creatingFirst = editing === 'new' && groups.length === 0
    return (
      <div className="flex w-full min-w-0 flex-col gap-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">
            {editing === 'new' ? t('newGroup') : t('editGroup')}
          </h2>

          {creatingFirst ? (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            >
              {t('firstGroupWarning')}
            </p>
          ) : null}

          <label className="mt-4 grid gap-2">
            <span className="text-sm font-medium text-foreground">
              {t('nameLabel')}
            </span>
            <Input
              value={name}
              maxLength={191}
              onChange={event => setName(event.target.value)}
              placeholder={t('namePlaceholder')}
              autoComplete="off"
            />
          </label>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="grid content-start gap-2">
              <span className="text-sm font-medium text-foreground">
                {t('membersLabel', { count: memberIds.length })}
              </span>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={userFilter}
                  onChange={event => setUserFilter(event.target.value)}
                  placeholder={t('searchUser')}
                  autoComplete="off"
                  className="pl-8"
                />
              </div>
              <CheckList
                items={filteredUsers.map(user => ({
                  id: user.id,
                  label: user.name,
                  hint: user.position,
                }))}
                selected={memberIds}
                onToggle={id => setMemberIds(prev => toggle(prev, id))}
                empty={t('noUsers')}
              />
            </div>

            <div className="grid content-start gap-2">
              <span className="text-sm font-medium text-foreground">
                {t('linesLabel', { count: lineIds.length })}
              </span>
              <CheckList
                items={lines.map(line => ({ id: line.id, label: line.name }))}
                selected={lineIds}
                onToggle={id => setLineIds(prev => toggle(prev, id))}
                empty={t('noLines')}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setEditing(null)}
            >
              {t('cancel')}
            </Button>
            <Button
              disabled={saving || !name.trim()}
              onClick={() => void handleSave()}
            >
              {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheckIcon className="h-7 w-7 text-primary" />
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
        <Button onClick={() => openEditor('new')} disabled={loading}>
          <PlusIcon />
          {t('newGroup')}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">{t('loading')}</p>
        ) : groups.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          groups.map(group => {
            const groupLines = group.lineIds.filter(id => lineNameById.has(id))
            return (
              <div
                key={group.id}
                className="flex flex-col gap-3 border-b border-border p-6 last:border-b-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-foreground">
                    {group.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('membersCount', { count: group.memberIds.length })} ·{' '}
                    {t('linesCount', { count: groupLines.length })}
                  </p>
                  {group.memberIds.length > 0 ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {group.memberIds
                        .map(id => userNameById.get(id) ?? id)
                        .join(', ')}
                    </p>
                  ) : null}
                  {groupLines.length > 0 ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {groupLines
                        .map(id => lineNameById.get(id) ?? id)
                        .join(', ')}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-amber-800">
                      {t('noLinesWarning')}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {confirmingDeleteId === group.id ? (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={saving}
                        onClick={() => void handleDelete(group)}
                      >
                        {t('confirmDelete')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmingDeleteId('')}
                      >
                        {t('cancel')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditor(group)}
                      >
                        {t('edit')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmingDeleteId(group.id)}
                      >
                        {t('delete')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
