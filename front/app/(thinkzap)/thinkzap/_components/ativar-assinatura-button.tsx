'use client'

import { useState } from 'react'

import axios from 'axios'

import { getAppRedirectUrl } from '@/app/config/app-redirects'

import { envConfig } from '@/shared/infra/env-config'
import { useTranslation } from 'react-i18next'

import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { Button } from '@/components/ui/button'

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

export function AtivarAssinaturaButton({
  className = '',
  variant = 'primary',
  showPortalLink = true,
  layout = 'stack',
}: Props) {
  const { t } = useTranslation('thinkzap/ativar-assinatura-button')
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

      window.alert(apiErrorMessage(e, t('erroEfetivar')))
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

      const url = (data as { url: string }).url

      if (url) {
        openBillingPortalUrl(url)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingPortal(false)
    }
  }

  const primaryVariant = variant === 'primary' ? 'default' : 'outline'
  const busy = loadingTrial || loadingPortal

  const primaryBtn = (
    <Button
      type="button"
      variant={primaryVariant}
      onClick={() => void endTrial()}
      disabled={busy}
    >
      {loadingTrial ? t('efetivando') : t('efetivarAgora')}
    </Button>
  )

  const portalBtn = showPortalLink ? (
    <Button
      type="button"
      variant="outline"
      onClick={() => void openPortal()}
      disabled={busy}
    >
      {loadingPortal ? t('abrindoPortal') : t('cartaoFaturas')}
    </Button>
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
      {primaryBtn}
      {portalBtn}
    </div>
  )
}
