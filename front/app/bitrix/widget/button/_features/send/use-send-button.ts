'use client'

import { useCallback, useState } from 'react'
import type { ImbotAuth } from '@/app/bitrix/widget/audio/_domain/imbot-context'
import type { WidgetButtonPayload } from '@/app/(widgets)/layouts/button-composer'
import {
  NEED_OPERATOR_OAUTH,
  sendButtonToChat,
  type SendButtonError,
} from './send-button-client'

type UseSendButtonParams = {
  endpoint: string
  dialogId: string | null
  domain: string | null
  imbotAuth: ImbotAuth | null
  accessToken: string | null
  canSend: boolean
  onSuccess: () => void
}

export function useSendButton({
  endpoint,
  dialogId,
  domain,
  imbotAuth,
  accessToken,
  canSend,
  onSuccess,
}: UseSendButtonParams) {
  const [isSending, setIsSending] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsOperatorOAuth, setNeedsOperatorOAuth] = useState(false)

  const send = useCallback(
    async (params: {
      body: string
      header: string
      footer: string
      buttons: WidgetButtonPayload[]
    }) => {
      if (!canSend) {
        setError(
          'Abra o widget pelo painel do chat no Bitrix24 para enviar botões.',
        )
        return
      }

      if (!dialogId) {
        setError('Chat não identificado. Reabra o widget no chat.')
        return
      }

      if (!domain) {
        setError('Domínio Bitrix24 não identificado.')
        return
      }

      try {
        setError(null)
        setNeedsOperatorOAuth(false)
        setIsSending(true)

        await sendButtonToChat({
          endpoint,
          dialogId,
          domain,
          imbotAuth,
          accessToken,
          ...params,
        })

        onSuccess()
        setIsSent(true)
      } catch (err) {
        console.error(err)
        const sendErr = err as SendButtonError
        if (sendErr.code === NEED_OPERATOR_OAUTH) {
          setNeedsOperatorOAuth(true)
          setError(null)
          return
        }
        setError('Não foi possível enviar os botões.')
      } finally {
        setIsSending(false)
      }
    },
    [canSend, dialogId, domain, endpoint, imbotAuth, accessToken, onSuccess],
  )

  const resetSent = useCallback(() => {
    setIsSent(false)
  }, [])

  return {
    isSending,
    isSent,
    error,
    needsOperatorOAuth,
    setError,
    send,
    resetSent,
  }
}
