'use client'

import { useEffect, useState } from 'react'
import type { LogsHttpClient } from './logs-view'

type State =
  | { status: 'loading' }
  | { status: 'ready'; client: LogsHttpClient }
  | { status: 'unauthenticated' }

/**
 * Resolve o client só após montar. O token vive em sessionStorage (client-only),
 * então resolver no render causaria mismatch de hidratação com o SSR.
 */
export function useLogsClient(resolve: () => LogsHttpClient | null): State {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    try {
      const client = resolve()
      setState(
        client ? { status: 'ready', client } : { status: 'unauthenticated' },
      )
    } catch {
      setState({ status: 'unauthenticated' })
    }
  }, [])

  return state
}
