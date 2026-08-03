/* eslint-disable @typescript-eslint/no-misused-promises */
'use client'

import { useState, useMemo } from 'react'
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
import axios from 'axios'

/** URL da sua API que recebe o payload da instalação (auth + appInfo + email). Configure em .env.local. */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

const MESSAGES = {
  acceptAll:
    'É necessário aceitar os termos, o contrato de licença e a política de privacidade.',
  emailRequired: 'Informe o e-mail de instalação.',
  bx24Unavailable: 'BX24 não disponível. Abra esta página no Bitrix24.',
  installError: 'Erro ao concluir instalação.',
  apiError: 'Falha ao registrar a instalação. Tente novamente.',
} as const

/** Nome de passo → o que o usuário precisa entender que falhou. */
const STEP_LABELS: Record<string, string> = {
  'resolve-app-code': 'identificar o aplicativo',
  'upsert-domain': 'registrar o portal',
  'upsert-app': 'registrar a instalação',
  'upsert-credential': 'salvar as credenciais de acesso',
  'resolve-spa-item': 'registrar o cliente no CRM',
  'link-spa-item': 'vincular a instalação ao cliente',
  'run-installer': 'configurar o aplicativo no portal',
}

/**
 * A API devolve `{ result: { error: { step, message } } }` quando a instalação
 * aborta. Sem ler o passo, toda falha vira a mesma mensagem genérica e o suporte
 * precisa do log para saber onde parou.
 */
function installErrorMessage(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : MESSAGES.installError
  }

  const payload = err.response?.data as
    | { result?: { error?: { step?: string; message?: string } } }
    | undefined
  const failure = payload?.result?.error

  if (!failure?.step) return MESSAGES.apiError

  const label = STEP_LABELS[failure.step] ?? failure.step

  return `Falha ao ${label}: ${failure.message ?? MESSAGES.apiError}`
}

export default function BitrixInstallPage() {
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
      setErrorMessage(MESSAGES.acceptAll)
      return
    }
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setErrorMessage(MESSAGES.emailRequired)
      return
    }
    if (!window.BX24) {
      setErrorMessage(MESSAGES.bx24Unavailable)
      return
    }

    setStatus('loading')
    try {
      const payload = await getInstallPayload(trimmedEmail)
      if (!payload) {
        setErrorMessage(MESSAGES.bx24Unavailable)
        setStatus('idle')
        return
      }

      // `finishInstall()` só depois de 2xx: a instalação é fail-fast no backend,
      // e concluir no Bitrix depois de uma falha deixaria o app registrado no
      // portal sem estar configurado.
      if (API_URL) {
        await axios.post(API_URL + '/auth/install', payload)
      }

      finishInstall()
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMessage(installErrorMessage(err))
    }
  }

  const renderContent = () => {
    if (!scriptLoaded) {
      return <InstallLoading message="Carregando..." />
    }
    if (!ready && !bx24Error) {
      return <InstallLoading message="Conectando ao Bitrix24..." />
    }
    if (bx24Error && !ready) {
      return <InstallError message={bx24Error} />
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
