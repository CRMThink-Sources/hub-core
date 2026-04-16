'use client'

import { useState } from 'react'

import axios from 'axios'

import { getAppRedirectUrl } from '@/app/config/app-redirects'

import { envConfig } from '@/shared/infra/env-config'

import { axiosThinkzap } from '@/infra/client/axios-thinkzap'

type Props = {
  className?: string
  variant?: 'primary' | 'outline'
  /** Link secundário para o Customer Portal (cartão, faturas). */
  showPortalLink?: boolean
  /**
   * `stack` — coluna alinhada à direita (ex.: gestão de linhas).
   * `inline` — botões em sequência (largura natural); use com `justify-end` no pai.
   */
  layout?: 'stack' | 'inline'
}

function reloadAppWindow(): void {
  try {
    if (window.top != null && window.top !== window.self) {
      window.top.location.reload()

      return
    }
  } catch {
    /* continua */
  }

  window.location.reload()
}

/**

 * Stripe não carrega em iframe — portal abre fora do embed (`_top` primeiro).

 */

function openBillingPortalUrl(url: string): void {
  try {
    const a = document.createElement('a')

    a.href = url

    a.target = '_blank'

    a.rel = 'noopener noreferrer'

    document.body.appendChild(a)

    a.click()

    a.remove()

    return
  } catch {
    /* continua */
  }

  try {
    if (window.top != null && window.top !== window.self) {
      window.top.location.assign(url)

      return
    }
  } catch {
    /* continua */
  }

  const win = window.open(url, '_blank', 'noopener,noreferrer')

  if (win == null && window.self === window.top) {
    window.location.assign(url)
  }
}

function apiErrorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e) && e.response?.data?.result?.error) {
    return String(
      (e.response.data as { result?: { error?: string } }).result?.error,
    )
  }

  return fallback
}

/** Botões em linha alinhados à direita (ex.: header Conexões) — largura natural, sem esticar. */
const actionBtnInline =
  'inline-flex min-h-[42px] shrink-0 max-w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

export function AtivarAssinaturaButton({
  className = '',
  variant = 'primary',
  showPortalLink = true,
  layout = 'stack',
}: Props) {
  const [loadingTrial, setLoadingTrial] = useState(false)

  const [loadingPortal, setLoadingPortal] = useState(false)

  const endTrial = async () => {
    const key = getAppRedirectUrl(
      envConfig.appCodes.thinkzap,
    )?.storageAuthTokenKey

    if (!key) return

    setLoadingTrial(true)

    try {
      const client = axiosThinkzap(key)

      await client.post('/thinkzap/subscription/end-trial')

      reloadAppWindow()
    } catch (e: unknown) {
      console.error(e)

      window.alert(
        apiErrorMessage(
          e,

          'Não foi possível efetivar a assinatura. Tente de novo em instantes.',
        ),
      )
    } finally {
      setLoadingTrial(false)
    }
  }

  const openPortal = async () => {
    const key = getAppRedirectUrl(
      envConfig.appCodes.thinkzap,
    )?.storageAuthTokenKey

    if (!key) return

    setLoadingPortal(true)

    try {
      const client = axiosThinkzap(key)

      const data = await client.post('/thinkzap/subscription/billing-portal')

      const url = (data as unknown as { url: string }).url

      if (url) {
        openBillingPortalUrl(url)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingPortal(false)
    }
  }

  const base =
    variant === 'primary'
      ? 'bg-[#5A997E] text-white hover:bg-[#4a8169] border border-transparent'
      : 'bg-white text-[#5A997E] border border-[#5A997E] hover:bg-[#f0faf5]'

  const outline =
    'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'

  const busy = loadingTrial || loadingPortal

  const primaryBtn = (
    <button
      type="button"
      onClick={() => void endTrial()}
      disabled={busy}
      className={`cursor-pointer ${actionBtnInline} ${base}`}
    >
      {loadingTrial ? 'Efetivando…' : 'Efetivar assinatura agora'}
    </button>
  )

  const portalBtn = showPortalLink ? (
    <button
      type="button"
      onClick={() => void openPortal()}
      disabled={busy}
      className={`cursor-pointer ${actionBtnInline} ${outline}`}
    >
      {loadingPortal ? 'Abrindo portal…' : 'Cartão e faturas (Stripe)'}
    </button>
  ) : null

  if (layout === 'inline') {
    return (
      <>
        {primaryBtn}
        {portalBtn}
      </>
    )
  }

  return (
    <div className={`flex w-full flex-col items-end gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => void endTrial()}
        disabled={busy}
        className={`font-medium cursor-pointer rounded-lg px-5 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${base}`}
      >
        {loadingTrial ? 'Efetivando…' : 'Efetivar assinatura agora'}
      </button>
      {showPortalLink && (
        <button
          type="button"
          onClick={() => void openPortal()}
          disabled={busy}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${outline}`}
        >
          {loadingPortal ? 'Abrindo portal…' : 'Cartão e faturas (Stripe)'}
        </button>
      )}
    </div>
  )
}
