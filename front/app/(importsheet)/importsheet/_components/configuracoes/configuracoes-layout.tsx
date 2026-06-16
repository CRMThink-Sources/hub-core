'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { XIcon } from 'lucide-react'
import { useSession } from '@/providers/session-provider'
import { axiosImportsheet } from '@/infra/client/axios-importsheet'
import { envConfig } from '@/shared/infra/env-config'
import { Button } from '@/components/ui/button'
import type { GoogleConnection } from '../types'

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
    </div>
  )
}
