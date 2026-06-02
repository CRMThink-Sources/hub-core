'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from '@/providers/session-provider'
import { axiosImportsheet } from '@/infra/client/axios-importsheet'
import { envConfig } from '@/shared/infra/env-config'
import type { GoogleConnection } from '../types'

export default function ConfiguracoesLayout() {
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

  // Limpa o poll do popup ao desmontar.
  useEffect(() => {
    return () => {
      if (popupTimerRef.current) clearInterval(popupTimerRef.current)
    }
  }, [])

  const loading = isFetching && !session

  useEffect(() => {
    // O callback do OAuth roda no domínio da API, não no do front — a origem
    // esperada é a da apiUrl. Se não der pra resolver, não filtra por origem.
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
      // Popup fechado sem concluir (sem postMessage) → destrava o botão.
      if (popupTimerRef.current) clearInterval(popupTimerRef.current)
      popupTimerRef.current = setInterval(() => {
        if (!win || win.closed) {
          if (popupTimerRef.current) clearInterval(popupTimerRef.current)
          setConnecting(false)
        }
      }, 500)
    } catch {
      setConnecting(false)
      setBanner('error')
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Desconectar a conta Google deste app?')) return
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
    <div className="w-full flex flex-col pt-20 px-6 space-y-4">
      {/* header */}
      <div className="flex items-center justify-between w-full max-w-3xl mx-auto bg-white p-6 rounded-xl border border-[#e5e7eb]">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Configurações</h1>
          <h2 className="text-sm text-gray-400 mt-1">
            Integrações e conexões do app
          </h2>
        </div>
      </div>

      {/* feedback */}
      {banner && (
        <div
          role="status"
          aria-live="polite"
          className={`w-full max-w-3xl mx-auto px-4 py-3 rounded-lg text-sm flex items-center justify-between border ${
            banner === 'success'
              ? 'bg-gray-50 text-gray-800 border-gray-300'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          <span>
            {banner === 'success'
              ? 'Conta Google conectada com sucesso.'
              : 'Algo deu errado. Tente novamente.'}
          </span>
          <button
            onClick={() => setBanner(null)}
            aria-label="Fechar aviso"
            className="ml-4 text-xs opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* card conexão Google */}
      <div className="w-full max-w-3xl mx-auto bg-white p-6 rounded-xl border border-[#e5e7eb]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              Conexão Google
            </h3>
            {loading ? (
              <p className="text-sm text-gray-400 mt-1">Carregando…</p>
            ) : connection.connected ? (
              <p className="text-sm text-gray-500 mt-1">
                Conectado{connection.email ? ` · ${connection.email}` : ''}
              </p>
            ) : (
              <p className="text-sm text-gray-400 mt-1">
                Nenhuma conta Google conectada.
              </p>
            )}
          </div>

          {loading ? null : connection.connected ? (
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-sm font-semibold px-4 py-2 rounded-lg border border-red-200 text-red-600 bg-white
                       hover:bg-red-50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {disconnecting ? 'Desconectando…' : 'Desconectar'}
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border border-[#e5e7eb] bg-white
                       hover:bg-gray-50 hover:border-gray-900 hover:text-gray-900 transition-all cursor-pointer
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connecting ? 'Conectando…' : 'Conectar com Google'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
