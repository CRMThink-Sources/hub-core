'use client'

import { useEffect, useState } from 'react'
import type { B24FrameClient } from './b24-jssdk.types'

export interface UseB24FrameResult {
  ready: boolean
  error: string | null
  client: B24FrameClient | null
}

/**
 * Inicializa o B24Js SDK dentro do iframe do messenger.
 * As chamadas REST feitas por este client rodam no contexto do usuario logado.
 */
export function useB24Frame(scriptLoaded: boolean): UseB24FrameResult {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [client, setClient] = useState<B24FrameClient | null>(null)

  useEffect(() => {
    if (!scriptLoaded || typeof window === 'undefined') return

    let cancelled = false

    const init = async () => {
      if (!window.B24Js?.initializeB24Frame) {
        if (!cancelled) {
          setError('SDK do Bitrix24 indisponivel neste iframe.')
        }
        return
      }

      try {
        const frame = await window.B24Js.initializeB24Frame()
        if (cancelled) return
        setClient(frame)
        setReady(true)
        setError(null)
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setError('Nao foi possivel conectar ao Bitrix24.')
      }
    }

    void init()

    return () => {
      cancelled = true
    }
  }, [scriptLoaded])

  return { ready, error, client }
}
