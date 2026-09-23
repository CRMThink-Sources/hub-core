'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CheckIcon, SearchIcon, BellIcon, XIcon } from 'lucide-react'
import { isBitrixAdmin } from '@/bitrix'
import { useThinkzapApi } from '@/app/hooks/use-thinkzap-api'
import { useThinkzapAccess } from '@/app/hooks/use-thinkzap-permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type PortalUser = { id: string; name: string; position?: string }

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function NotificacoesConexaoSection() {
  const { t } = useTranslation('thinkzap/notificacoes-conexao')
  const thinkzapAccess = useThinkzapAccess()
  const api = useThinkzapApi()

  const canManage = thinkzapAccess?.canManageAccess === true || isBitrixAdmin()

  const [users, setUsers] = useState<PortalUser[]>([])
  const [notifyIds, setNotifyIds] = useState<number[]>([])
  // Snapshot do que está persistido — base do estado "sujo" (não salvo).
  const [savedIds, setSavedIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [userFilter, setUserFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [usersData, settingsData] = await Promise.all([
        api.get<{ users: PortalUser[] }>('/thinkzap/portal-users'),
        api.get<{ userIds: number[] }>('/thinkzap/disconnect-notify-settings'),
      ])
      setUsers(usersData.users ?? [])
      setNotifyIds(settingsData.userIds ?? [])
      setSavedIds(settingsData.userIds ?? [])
    } catch {
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [api, t])

  useEffect(() => {
    if (!canManage) return
    void load()
  }, [canManage, load])

  function toggleNotify(id: number) {
    setJustSaved(false)
    setNotifyIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    )
  }

  function clearNotify() {
    setJustSaved(false)
    setNotifyIds([])
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await api.patch<{ userIds: number[] }>(
        '/thinkzap/disconnect-notify-settings',
        { userIds: notifyIds },
      )
      const saved = res.userIds ?? notifyIds
      setNotifyIds(saved)
      setSavedIds(saved)
      setJustSaved(true)
    } catch {
      toast.error(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userFilter.trim().toLowerCase()),
  )
  // Selecionados no topo; dentro de cada grupo mantém a ordem original (nome).
  const orderedUsers = [...filteredUsers].sort((a, b) => {
    const aSel = notifyIds.includes(Number(a.id)) ? 0 : 1
    const bSel = notifyIds.includes(Number(b.id)) ? 0 : 1
    return aSel - bSel
  })
  const selectedUsers = users.filter(u => notifyIds.includes(Number(u.id)))
  // "Sujo": seleção atual difere do que está salvo (compara como conjunto).
  const notifyDirty =
    notifyIds.length !== savedIds.length ||
    notifyIds.some(id => !savedIds.includes(id))

  if (!canManage) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-4">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('adminOnly')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <BellIcon className="h-7 w-7 text-primary" />
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
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-start gap-3 border-b border-border p-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                {t('destinatarios')}
              </h3>
              {!loading && notifyIds.length > 0 && (
                <span className="inline-flex h-5 items-center rounded-full bg-primary/10 px-2 text-xs font-medium text-primary">
                  {t('contagemSelecionados', { count: notifyIds.length })}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('destinatariosDescricao')}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">{t('carregando')}</p>
        ) : users.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {t('nenhumUsuario')}
          </p>
        ) : (
          <>
            <div className="border-b border-border bg-muted/30 px-6 py-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t('destinatarios')}
                </span>
                {notifyIds.length > 0 && (
                  <button
                    type="button"
                    onClick={clearNotify}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {t('limparTodos')}
                  </button>
                )}
              </div>
              {selectedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('semSelecionados')}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map(u => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pr-1 pl-1.5 text-sm shadow-xs"
                    >
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                        {initials(u.name)}
                      </span>
                      <span className="text-foreground">{u.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleNotify(Number(u.id))}
                        aria-label={t('removerDestinatario', { name: u.name })}
                        className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6">
              <div className="relative mb-3">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value)}
                  placeholder={t('buscarUsuario')}
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  data-bwignore
                  data-form-type="other"
                  className="pl-8"
                />
              </div>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
                {orderedUsers.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {t('nenhumResultado')}
                  </p>
                ) : (
                  orderedUsers.map(u => {
                    const checked = notifyIds.includes(Number(u.id))
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleNotify(Number(u.id))}
                        aria-pressed={checked}
                        className={`flex w-full cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 ${
                          checked
                            ? 'bg-primary/5 hover:bg-primary/10'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                            checked
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {checked ? (
                            <CheckIcon className="size-4" />
                          ) : (
                            initials(u.name)
                          )}
                        </span>
                        <span
                          className={`min-w-0 flex-1 truncate ${
                            checked
                              ? 'font-medium text-foreground'
                              : 'text-foreground'
                          }`}
                        >
                          {u.name}
                        </span>
                        <span
                          className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            checked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-input bg-transparent'
                          }`}
                        >
                          {checked && <CheckIcon className="size-3.5" />}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-border bg-muted/30 px-6 py-4">
              <span className="text-sm text-muted-foreground">
                {notifyDirty ? (
                  <span className="text-foreground">
                    {t('alteracoesNaoSalvas')}
                  </span>
                ) : justSaved ? (
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <CheckIcon className="size-4 text-primary" />
                    {t('tudoSalvo')}
                  </span>
                ) : null}
              </span>
              <Button
                onClick={() => void handleSave()}
                disabled={saving || !notifyDirty}
              >
                {saving ? t('salvando') : t('salvar')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
