'use client'

import { useEffect, useState } from 'react'
import { fetchCurrentUserFromCallMethod } from '@/bitrix'

type State = { status: 'loading' } | { status: 'ready'; name: string | null }

/**
 * Nome do usuário Bitrix logado (`NAME` + `LAST_NAME`), via `user.current`.
 *
 * `name: null` cobre tanto "Bitrix não devolveu NAME/LAST_NAME" quanto "BX24
 * indisponível" (app aberto fora do iframe, chamada falhou) — o chamador decide
 * o fallback; este hook só resolve o que dá.
 */
export function useBitrixUserName(bx24Ready: boolean): State {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    if (!bx24Ready) return

    let cancelled = false

    fetchCurrentUserFromCallMethod()
      .then(user => {
        if (cancelled) return
        const name = [user.NAME, user.LAST_NAME]
          .filter(Boolean)
          .join(' ')
          .trim()
        setState({ status: 'ready', name: name || null })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'ready', name: null })
      })

    return () => {
      cancelled = true
    }
  }, [bx24Ready])

  return state
}
