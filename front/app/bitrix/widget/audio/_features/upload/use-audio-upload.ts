'use client'

import { useCallback, useState } from 'react'
import type { ImbotAuth } from '../../_domain/imbot-context'
import {
  NEED_OPERATOR_OAUTH,
  uploadAudioToChat,
  type UploadAudioError,
} from './upload-audio-client'

type UseAudioUploadParams = {
  endpoint: string
  dialogId: string | null
  domain: string | null
  imbotAuth: ImbotAuth | null
  accessToken: string | null
  canUpload: boolean
  onSuccess: () => void
}

export function useAudioUpload({
  endpoint,
  dialogId,
  domain,
  imbotAuth,
  accessToken,
  canUpload,
  onSuccess,
}: UseAudioUploadParams) {
  const [isSending, setIsSending] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsOperatorOAuth, setNeedsOperatorOAuth] = useState(false)

  const sendAudio = useCallback(
    async (audioBlob: Blob | null) => {
      if (!audioBlob) return

      if (!canUpload) {
        setError(
          'Abra o widget pelo painel do chat no Bitrix24 para enviar audio.',
        )
        return
      }

      if (!dialogId) {
        setError('Chat nao identificado. Reabra o widget no chat.')
        return
      }

      if (!domain) {
        setError('Dominio Bitrix24 nao identificado.')
        return
      }

      try {
        setError(null)
        setNeedsOperatorOAuth(false)
        setIsSending(true)

        await uploadAudioToChat({
          endpoint,
          audioBlob,
          dialogId,
          domain,
          imbotAuth,
          accessToken,
        })

        onSuccess()
        setIsSent(true)
      } catch (err) {
        console.error(err)
        const uploadErr = err as UploadAudioError
        if (uploadErr.code === NEED_OPERATOR_OAUTH) {
          setNeedsOperatorOAuth(true)
          setError(null)
          return
        }
        setError('Nao foi possivel enviar o audio.')
      } finally {
        setIsSending(false)
      }
    },
    [
      canUpload,
      dialogId,
      domain,
      endpoint,
      imbotAuth,
      accessToken,
      onSuccess,
    ],
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
    sendAudio,
    resetSent,
  }
}
