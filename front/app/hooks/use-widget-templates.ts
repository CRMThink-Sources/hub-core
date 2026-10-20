import { useCallback, useEffect, useRef, useState } from 'react'
import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
} from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'

/**
 * Botão do template como o catálogo do widget informa. `index` é a posição entre
 * todos os botões — é ele que vai no envio; `dynamic` diz se o operador precisa
 * informar um valor (final do link ou código do cupom).
 */
export type WidgetTemplateButton = {
  index: number
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'OTHER'
  text: string
  dynamic: boolean
}

/** O que a rota do widget devolve por template, sem credencial. */
export type WidgetTemplate = {
  name: string
  language: string
  /** Corpo com os placeholders intactos: o widget deriva os campos dele. */
  body: string
  /** Na ordem do template. Vazio em template sem botão. */
  buttons: WidgetTemplateButton[]
  /**
   * Cabeçalho. `IMAGE` exige a URL da imagem no envio. Opcional porque uma API
   * anterior a este campo não o manda — ausente vale como `NONE`.
   */
  header?: { type: 'NONE' | 'TEXT' | 'IMAGE' }
}

type WidgetTemplatesState = {
  templates: WidgetTemplate[]
  loading: boolean
  error: string
  /**
   * Se o ambiente hospeda a imagem do cabeçalho enviada como arquivo. Ausente na
   * resposta (API anterior) vale `false`: o widget oferece só o link.
   */
  headerImageUpload: boolean
}

const IDLE: WidgetTemplatesState = {
  templates: [],
  loading: false,
  error: '',
  headerImageUpload: false,
}

/**
 * Templates aprovados da linha selecionada, para o modo template do widget.
 *
 * Rota própria (`/thinkzap/messages/widget-templates/:id`) e não a da tela de
 * conexões: aquela exige `connectors:read`, que o operador do contact center
 * normalmente não tem. `useConnectorTemplates` continua servindo a tela de
 * conexões — cadastro e sincronização não existem aqui.
 *
 * A troca rápida de linha é o caso que este hook precisa acertar: sem guarda, a
 * resposta da linha anterior sobrescreveria a lista da atual, e o operador
 * escolheria um template que não é da linha que vai enviar. O `AbortController` corta
 * a requisição e o id da linha é reconferido antes de qualquer `setState`.
 *
 * `lineId` vazio (nenhuma linha, ou linha não oficial) limpa o estado sem
 * requisição.
 */
export function useWidgetTemplates(lineId: string) {
  const [state, setState] = useState<WidgetTemplatesState>(IDLE)
  /** Última linha pedida — a resposta de outra linha é descartada. */
  const requestedLineRef = useRef('')

  useEffect(() => {
    requestedLineRef.current = lineId

    if (!lineId) {
      setState(IDLE)
      return
    }

    const client = resolveThinkzapClient()
    if (!client.ok) {
      setState({ ...IDLE, error: client.message })
      return
    }

    const controller = new AbortController()
    setState({ ...IDLE, loading: true })

    const fetchTemplates = async () => {
      try {
        const response = await client.client.get<{
          templates: WidgetTemplate[]
          headerImageUpload?: boolean
        }>(
          `/thinkzap/messages/widget-templates/${encodeURIComponent(lineId)}`,
          {
            signal: controller.signal,
          },
        )

        if (controller.signal.aborted) return
        if (requestedLineRef.current !== lineId) return

        setState({
          templates: response.templates,
          loading: false,
          error: '',
          headerImageUpload: response.headerImageUpload === true,
        })
      } catch (error) {
        if (controller.signal.aborted) return
        if (requestedLineRef.current !== lineId) return

        /**
         * A mensagem do servidor é preservada: é ela que distingue "conclua a conexão
         * do número" de "esta linha não tem templates". Cair num texto genérico
         * mandaria o operador procurar no lugar errado.
         *
         * Lista **vazia** e não mantida: template de outra linha não pode continuar
         * ofertado depois de uma falha.
         */
        setState({
          ...IDLE,
          error: thinkzapApiErrorMessage(
            error,
            'Não foi possível carregar os templates desta linha.',
          ),
        })
      }
    }

    void fetchTemplates()

    return () => controller.abort()
  }, [lineId])

  const clearError = useCallback(() => {
    setState(previous => ({ ...previous, error: '' }))
  }, [])

  return { ...state, clearError }
}
