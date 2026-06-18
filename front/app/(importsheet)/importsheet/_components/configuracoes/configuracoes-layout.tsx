'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { XIcon, BellIcon, CheckIcon, SearchIcon } from 'lucide-react'
import { useSession } from '@/providers/session-provider'
import { axiosImportsheet } from '@/infra/client/axios-importsheet'
import { envConfig } from '@/shared/infra/env-config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { GoogleConnection, BitrixUser } from '../types'

export default function ConfiguracoesLayout() {
  const { t } = useTranslation('importsheet/configuracoes/page')
  const { session, isFetching, refreshSession } = useSession()
  const refreshSessionRef = useRef(refreshSession)
  useEffect(() => {
    refreshSessionRef.current = refreshSession
  })

  const connection = (session?.googleConnection as GoogleConnection) ?? {
    connected: false,
    email: null,
  }

  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [banner, setBanner] = useState<'success' | 'error' | null>(null)
  const popupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Notificações de erro: lista de usuários ativos + destinatários selecionados.
  const [users, setUsers] = useState<BitrixUser[]>([])
  const [notifyIds, setNotifyIds] = useState<number[]>([])
  // Snapshot do que está persistido — base do estado "sujo" (não salvo).
  const [savedIds, setSavedIds] = useState<number[]>([])
  const [loadingNotify, setLoadingNotify] = useState(true)
  const [savingNotify, setSavingNotify] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [userFilter, setUserFilter] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const [usersRes, settingsRes] = await Promise.all([
          axiosImportsheet().get('/importsheet/bitrix/users') as unknown as {
            users: BitrixUser[]
          },
          axiosImportsheet().get('/importsheet/settings/notify') as unknown as {
            userIds: number[]
          },
        ])
        if (!active) return
        setUsers(usersRes.users ?? [])
        setNotifyIds(settingsRes.userIds ?? [])
        setSavedIds(settingsRes.userIds ?? [])
      } catch {
        // silencioso: o card mostra estado vazio; banner é só pro fluxo Google
      } finally {
        if (active) setLoadingNotify(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

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

  async function handleSaveNotify() {
    try {
      setSavingNotify(true)
      const res = (await axiosImportsheet().put('/importsheet/settings/notify', {
        userIds: notifyIds,
      })) as unknown as { userIds: number[] }
      const saved = res.userIds ?? notifyIds
      setNotifyIds(saved)
      setSavedIds(saved)
      setJustSaved(true)
    } catch {
      setBanner('error')
    } finally {
      setSavingNotify(false)
    }
  }

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userFilter.trim().toLowerCase()),
  )
  // Selecionados no topo; dentro de cada grupo mantém a ordem original (nome).
  const orderedUsers = [...filteredUsers].sort((a, b) => {
    const aSel = notifyIds.includes(a.id) ? 0 : 1
    const bSel = notifyIds.includes(b.id) ? 0 : 1
    return aSel - bSel
  })
  const selectedUsers = users.filter(u => notifyIds.includes(u.id))
  // "Sujo": seleção atual difere do que está salvo (compara como conjunto).
  const notifyDirty =
    notifyIds.length !== savedIds.length ||
    notifyIds.some(id => !savedIds.includes(id))

  function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  useEffect(() => {
    return () => {
      if (popupTimerRef.current) clearInterval(popupTimerRef.current)
    }
  }, [])

  const loading = isFetching && !session

  useEffect(() => {
    let apiOrigin: string | null = null
    try {
      apiOrigin = new URL(envConfig.apiUrl).origin
    } catch {
      apiOrigin = null
    }

    function handleMessage(event: MessageEvent) {
      if (apiOrigin && event.origin !== apiOrigin) return
      if (!event.data || event.data.type !== 'google-oauth') return
      if (event.data.status !== 'success' && event.data.status !== 'error')
        return
      setBanner(event.data.status)
      setConnecting(false)
      if (event.data.status === 'success') {
        void refreshSessionRef.current()
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  async function handleConnect() {
    try {
      setBanner(null)
      setConnecting(true)
      const result = (await axiosImportsheet().get(
        '/importsheet/oauth/google/url',
      )) as unknown as { url: string }
      const win = window.open(
        result.url,
        'google-oauth',
        'width=500,height=700',
      )
      if (popupTimerRef.current) clearInterval(popupTimerRef.current)
      popupTimerRef.current = setInterval(() => {
        if (!win || win.closed) {
          if (popupTimerRef.current) clearInterval(popupTimerRef.current)
          setConnecting(false)
          // Fallback caso o postMessage do popup não chegue: o fechamento ainda
          // atualiza a conexão sem reload manual.
          void refreshSessionRef.current()
        }
      }, 500)
    } catch {
      setConnecting(false)
      setBanner('error')
    }
  }

  async function handleDisconnect() {
    if (!window.confirm(t('confirmarDesconectar'))) return
    try {
      setDisconnecting(true)
      await axiosImportsheet().post('/importsheet/oauth/google/disconnect')
      await refreshSession()
    } catch {
      setBanner('error')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-8 sm:px-6 lg:px-8">
      {/* header */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {t('titulo')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitulo')}</p>
      </div>

      {banner && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
            banner === 'success'
              ? 'border-border bg-muted/40 text-foreground'
              : 'border-destructive/20 bg-destructive/10 text-destructive'
          }`}
        >
          <span>{banner === 'success' ? t('sucesso') : t('erro')}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setBanner(null)}
            aria-label={t('fecharAviso')}
          >
            <XIcon />
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              {t('conexaoGoogle')}
            </h3>
            {loading ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {t('carregando')}
              </p>
            ) : connection.connected ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {t('conectado')}
                {connection.email ? ` · ${connection.email}` : ''}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {t('nenhumaConta')}
              </p>
            )}
          </div>

          {loading ? null : connection.connected ? (
            <Button
              variant="destructive"
              onClick={() => void handleDisconnect()}
              disabled={disconnecting}
            >
              {disconnecting ? t('desconectando') : t('desconectar')}
            </Button>
          ) : (
            <Button onClick={() => void handleConnect()} disabled={connecting}>
              {connecting ? t('conectando') : t('conectarGoogle')}
            </Button>
          )}
        </div>
      </div>

      {/* Notificações de erro */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-start gap-3 border-b border-border p-6">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BellIcon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                {t('notificacoesErro')}
              </h3>
              {!loadingNotify && notifyIds.length > 0 && (
                <span className="inline-flex h-5 items-center rounded-full bg-primary/10 px-2 text-xs font-medium text-primary">
                  {t('contagemSelecionados', { count: notifyIds.length })}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('notificacoesErroDescricao')}
            </p>
          </div>
        </div>

        {loadingNotify ? (
          <p className="p-6 text-sm text-muted-foreground">{t('carregando')}</p>
        ) : users.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {t('nenhumUsuario')}
          </p>
        ) : (
          <>
            {/* destinatários selecionados (chips) */}
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
                        onClick={() => toggleNotify(u.id)}
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

            {/* busca + lista */}
            <div className="p-6">
              <div className="relative mb-3">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value)}
                  placeholder={t('buscarUsuario')}
                  // Bloqueia autofill dos gerenciadores de senha (1Password/LastPass/Bitwarden)
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
                    const checked = notifyIds.includes(u.id)
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleNotify(u.id)}
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

            {/* footer: status + salvar */}
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
                onClick={() => void handleSaveNotify()}
                disabled={savingNotify || !notifyDirty}
              >
                {savingNotify ? t('salvando') : t('salvar')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
