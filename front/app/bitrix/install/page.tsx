/* eslint-disable @typescript-eslint/no-misused-promises */
'use client'

import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { BX24Script, useBX24 } from '@/bitrix'
import {
  InstallLoading,
  InstallError,
  InstallSuccess,
  InstallForm,
  TermsAgreement,
  useBitrixTermsAgreement,
} from '@/components/bitrix/install'
import type { InstallStatus } from '@/bitrix'
import { i18n, readStoredLocale } from '@/i18n/provider'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

const BITRIX_LANG_TO_LOCALE: Record<string, string> = {
  br: 'pt',
  en: 'en',
  la: 'es',
}

/**
 * A API devolve `{ result: { error: { step, message } } }` quando a instalação
 * aborta. Sem ler o passo, toda falha vira a mesma mensagem genérica e o suporte
 * precisa do log para saber onde parou.
 */
function installErrorMessage(err: unknown, t: TFunction): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : t('errors.install')
  }

  const payload = err.response?.data as
    | { result?: { error?: { step?: string; message?: string } } }
    | undefined
  const failure = payload?.result?.error

  if (!failure?.step) return t('errors.api')

  return t('errors.stepFailed', {
    step: t(`steps.${failure.step}`, { defaultValue: failure.step }),
    message: failure.message ?? t('errors.api'),
  })
}

export default function BitrixInstallPage() {
  const { t } = useTranslation('bitrix/install')
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const {
    ready,
    error: bx24Error,
    getInstallPayload,
    finishInstall,
  } = useBX24(scriptLoaded)

  const [email, setEmail] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [agreedToEula, setAgreedToEula] = useState(false)
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false)
  const [status, setStatus] = useState<InstallStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Primeiro acesso não tem idioma escolhido: o do portal é melhor palpite que
  // o do navegador. Escolha explícita (bandeira) prevalece.
  useEffect(() => {
    if (!ready || readStoredLocale()) return
    const locale = BITRIX_LANG_TO_LOCALE[window.BX24?.getLang?.() ?? '']
    if (locale) void i18n.changeLanguage(locale)
  }, [ready])

  const termsConfig = useBitrixTermsAgreement()
  const termsItems = useMemo(
    () => [
      {
        id: termsConfig[0].id,
        checked: agreedToTerms,
        onCheckedChange: setAgreedToTerms,
        label: termsConfig[0].label,
      },
      {
        id: termsConfig[1].id,
        checked: agreedToEula,
        onCheckedChange: setAgreedToEula,
        label: termsConfig[1].label,
      },
      {
        id: termsConfig[2].id,
        checked: agreedToPrivacy,
        onCheckedChange: setAgreedToPrivacy,
        label: termsConfig[2].label,
      },
    ],
    [agreedToTerms, agreedToEula, agreedToPrivacy, termsConfig],
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!agreedToTerms || !agreedToEula || !agreedToPrivacy) {
      setErrorMessage(t('errors.acceptAll'))
      return
    }
    const trimmedEmail = email.trim()
    if (!window.BX24) {
      setErrorMessage(t('errors.bx24Unavailable'))
      return
    }

    setStatus('loading')
    try {
      const payload = await getInstallPayload(trimmedEmail)
      if (!payload) {
        setErrorMessage(t('errors.bx24Unavailable'))
        setStatus('idle')
        return
      }

      // `finishInstall()` só depois de 2xx: a instalação é fail-fast no backend,
      // e concluir no Bitrix depois de uma falha deixaria o app registrado no
      // portal sem estar configurado.
      if (API_URL) {
        await axios.post(API_URL + '/auth/install', payload, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
        })
      }

      finishInstall()
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMessage(installErrorMessage(err, t))
    }
  }

  const renderContent = () => {
    if (!scriptLoaded) {
      return <InstallLoading message={t('loading')} />
    }
    if (!ready && !bx24Error) {
      return <InstallLoading message={t('connecting')} />
    }
    if (bx24Error && !ready) {
      return <InstallError message={t('errors.outsideBitrix')} />
    }
    if (status === 'success') {
      return <InstallSuccess />
    }
    return (
      <InstallForm
        email={email}
        onEmailChange={setEmail}
        termsSection={<TermsAgreement terms={termsItems} />}
        errorMessage={errorMessage}
        isSubmitting={status === 'loading'}
        onSubmit={handleSubmit}
      />
    )
  }

  return (
    <div id="bitrix-install-root" role="main" suppressHydrationWarning>
      <BX24Script onLoad={() => setScriptLoaded(true)} />
      {renderContent()}
    </div>
  )
}
