import { useEffect, useState } from 'react'
import { resolveThinkzapClient } from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'
import type { LineAccess } from '@/app/(widgets)/layouts/line-access'

export type MyLineAccessState =
  | { status: 'loading' }
  | { status: 'ready'; access: LineAccess }
  /**
   * Falha de leitura: o widget segue sem filtro. Quem decide é o servidor, que recusa
   * o envio por linha não permitida; esconder tudo por uma falha de leitura travaria
   * o operador de uma instalação sem grupos.
   */
  | { status: 'error' }

/**
 * Linhas que os grupos de acesso liberam ao usuário do widget.
 *
 * Lê a cada abertura do widget (a rota não usa o cache do contexto da aplicação),
 * para que mudança de grupo valha na próxima abertura.
 */
export function useMyLineAccess(): MyLineAccessState {
  const [state, setState] = useState<MyLineAccessState>({ status: 'loading' })

  useEffect(() => {
    const client = resolveThinkzapClient()
    if (!client.ok) {
      setState({ status: 'error' })
      return
    }

    const controller = new AbortController()

    const load = async () => {
      try {
        const access = await client.client.get<LineAccess>(
          '/thinkzap/access/my-lines',
          { signal: controller.signal },
        )
        if (controller.signal.aborted) return
        setState({ status: 'ready', access })
      } catch {
        if (controller.signal.aborted) return
        setState({ status: 'error' })
      }
    }

    void load()
    return () => controller.abort()
  }, [])

  return state
}
