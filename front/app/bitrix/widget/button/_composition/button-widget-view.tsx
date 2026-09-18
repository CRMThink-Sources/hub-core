'use client'

import { useState } from 'react'
import {
  ButtonComposer,
  buttonComposerValidationMessage,
  newWidgetButtonEntry,
  toButtonPayload,
  type WidgetButtonEntry,
  type WidgetButtonType,
} from '@/app/(widgets)/layouts/button-composer'
import { StatusBanner } from '@/app/bitrix/widget/audio/_components/status-banner'
import { OperatorOAuthPrompt } from '@/app/bitrix/widget/audio/_features/auth/operator-oauth-prompt'
import { useSendButton } from '../_features/send/use-send-button'
import { useButtonWidgetContext } from './button-widget-provider'

/**
 * Sem seleção de linha aqui — o canal aberto só conhece o `dialogId`, e é o
 * worker que resolve o provider da linha quando decodifica a mensagem
 * (mirror do design do widget de áudio). Por isso os três tipos ficam
 * sempre disponíveis: um tipo que a linha real não aceitar é recusado pelo
 * worker, que avisa o operador direto no canal aberto.
 */
const ALLOWED_TYPES: WidgetButtonType[] = ['REPLY', 'URL', 'CALL']

function ButtonWidgetSkeleton() {
  return (
    <div className="mx-auto w-full rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 animate-pulse rounded-full bg-slate-200" />
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
      </div>
      <p className="mt-3 text-xs text-slate-500">Carregando...</p>
    </div>
  )
}

export function ButtonWidgetView() {
  const {
    mounted,
    dialogId,
    domain,
    imbotAuth,
    accessToken,
    canSend,
    thinkzapAppCode,
    sendEndpoint,
  } = useButtonWidgetContext()

  const [body, setBody] = useState('')
  const [header, setHeader] = useState('')
  const [footer, setFooter] = useState('')
  const [buttons, setButtons] = useState<WidgetButtonEntry[]>([])

  const send = useSendButton({
    endpoint: sendEndpoint,
    dialogId,
    domain,
    imbotAuth,
    accessToken,
    canSend,
    onSuccess: () => {
      setBody('')
      setHeader('')
      setFooter('')
      setButtons([])
    },
  })

  if (!mounted) {
    return <ButtonWidgetSkeleton />
  }

  const addButton = (type: WidgetButtonType) => {
    setButtons(prev => [...prev, newWidgetButtonEntry(type)])
  }

  const updateButton = (id: string, patch: Partial<WidgetButtonEntry>) => {
    setButtons(prev =>
      prev.map(button => (button.id === id ? { ...button, ...patch } : button)),
    )
  }

  const removeButton = (id: string) => {
    setButtons(prev => prev.filter(button => button.id !== id))
  }

  const validationMessage = buttonComposerValidationMessage(
    body,
    buttons,
    ALLOWED_TYPES,
  )

  const displayError =
    send.error ??
    (!canSend
      ? 'Abra o widget pelo painel do chat no Bitrix24 (Canais Abertos).'
      : null)

  const handleSend = () => {
    if (validationMessage) return
    send.resetSent()
    void send.send({
      body,
      header,
      footer,
      buttons: buttons.map(toButtonPayload),
    })
  }

  return (
    <div className="mx-auto w-full rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <p className="text-sm font-semibold text-slate-700">
        Enviar mensagem com botões
      </p>

      <ButtonComposer
        body={body}
        onChangeBody={setBody}
        header={header}
        onChangeHeader={setHeader}
        footer={footer}
        onChangeFooter={setFooter}
        buttons={buttons}
        allowedTypes={ALLOWED_TYPES}
        onAddButton={addButton}
        onUpdateButton={updateButton}
        onRemoveButton={removeButton}
        disabled={send.isSending}
      />

      {validationMessage ? (
        <p className="mt-3 text-xs text-slate-500">{validationMessage}</p>
      ) : null}

      <button
        type="button"
        onClick={handleSend}
        disabled={send.isSending || Boolean(validationMessage) || !canSend}
        className="mt-4 h-11 w-full rounded-xl bg-blue-600 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {send.isSending ? 'Enviando...' : 'Enviar'}
      </button>

      {send.isSent ? (
        <StatusBanner
          variant="success"
          message="Botões enviados com sucesso!"
        />
      ) : null}

      {displayError ? (
        <StatusBanner variant="error" message={displayError} />
      ) : null}

      {send.needsOperatorOAuth && domain ? (
        <OperatorOAuthPrompt domain={domain} appCode={thinkzapAppCode} />
      ) : null}
    </div>
  )
}
