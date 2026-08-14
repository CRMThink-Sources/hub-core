import { AxiosError, AxiosInstance } from 'axios'
import { apiLogger } from '@/shared/infra/logger'

/**
 * Instrumentação de log para os clients HTTP de provider (Z-API, HubMessage).
 *
 * Existe porque os dois clients não logavam **nada**: quando o provider aceitava um
 * envio e a mensagem não chegava ao aparelho, não havia prova de que a chamada sequer
 * aconteceu. E quando falhava, o corpo da resposta — que é onde o provider diz o motivo
 * real — morria dentro da exceção.
 *
 * Interceptor e não instrumentação método a método: são 28 chamadas no client da Z-API
 * e 12 no da HubMessage, e um método novo nasceria sem log.
 *
 * ## O que NUNCA é logado, e por quê
 *
 * **Credencial.** A Z-API põe o token do cliente **na URL**
 * (`/instances/{id}/token/{token}/send-text`), e a HubMessage manda `Authorization:
 * Bearer`. Logar a URL crua ou os headers publicaria credencial de cliente no Loki,
 * onde ela ficaria pelo tempo de retenção e em qualquer backup. A URL é mascarada e
 * headers nunca são tocados.
 *
 * **Corpo de requisição.** É o texto da mensagem do cliente final — dado pessoal — e,
 * em mídia, base64 de até dezenas de MB. Só o tamanho é registrado.
 *
 * **Corpo de resposta grande.** QR code e listagens devolvem payloads enormes; acima do
 * limite, só o tamanho. Abaixo dele o corpo entra inteiro, que é o que torna útil a
 * resposta de um envio (`{ zaapId, messageId, id }`) e a de um erro.
 */

/** Acima disto, só o tamanho. Cobre resposta de envio e de erro; corta QR code e listagem. */
const MAX_LOGGED_BODY_CHARS = 2_000

/**
 * Mascara o token que a Z-API embute no caminho da URL.
 *
 * O segmento que segue `/token/` vira `***`, preservando o resto do caminho. O
 * `instanceId` fica: ele identifica a linha e não é credencial.
 */
export function redactProviderUrl(url: string | undefined): string {
  if (!url) return ''

  return url.replace(/\/token\/[^/]+/gi, '/token/***')
}

function describeBody(body: unknown): unknown {
  if (body === undefined || body === null) return undefined

  const serialized = typeof body === 'string' ? body : safeStringify(body)

  if (serialized === undefined) return '[não serializável]'
  if (serialized.length <= MAX_LOGGED_BODY_CHARS) return body

  return `[${serialized.length} chars omitidos]`
}

function safeStringify(value: unknown): string | undefined {
  try {
    return JSON.stringify(value)
  } catch {
    return undefined
  }
}

/** Tamanho do corpo enviado, sem o conteúdo. */
function requestBodySize(data: unknown): number | undefined {
  if (data === undefined || data === null) return undefined
  if (typeof data === 'string') return data.length

  return safeStringify(data)?.length
}

type ProviderRequestMeta = { startedAt: number }

/**
 * Liga o log de requisição e resposta numa instância axios.
 *
 * Sucesso sai em `debug` — o volume normal não precisa de uma linha por chamada, e quem
 * está investigando sobe o nível. **Falha sai em `error` com o corpo da resposta**, que
 * é onde o provider explica o motivo e é justamente o que se perdia.
 */
export function attachProviderHttpLogging(
  http: AxiosInstance,
  provider: 'ZAPI' | 'HUBMESSAGE',
): void {
  http.interceptors.request.use(config => {
    ;(config as unknown as ProviderRequestMeta).startedAt = Date.now()
    return config
  })

  http.interceptors.response.use(
    response => {
      const meta = response.config as unknown as ProviderRequestMeta

      apiLogger.debug(
        {
          app: 'thinkzap',
          provider,
          method: response.config.method?.toUpperCase(),
          url: redactProviderUrl(response.config.url),
          status: response.status,
          durationMs: meta.startedAt ? Date.now() - meta.startedAt : undefined,
          requestBytes: requestBodySize(response.config.data),
          response: describeBody(response.data),
        },
        'Provider respondeu',
      )

      return response
    },
    (error: unknown) => {
      if (error instanceof AxiosError) {
        const meta = error.config as unknown as ProviderRequestMeta | undefined

        apiLogger.error(
          {
            app: 'thinkzap',
            provider,
            method: error.config?.method?.toUpperCase(),
            url: redactProviderUrl(error.config?.url),
            status: error.response?.status,
            code: error.code,
            durationMs: meta?.startedAt
              ? Date.now() - meta.startedAt
              : undefined,
            /**
             * O corpo do erro é o ponto inteiro deste interceptor: é onde a Z-API diz
             * "número não existe no WhatsApp" e a HubMessage diz "fora da janela de
             * 24h". Sem ele, o log tem só um status e o diagnóstico vira adivinhação.
             */
            response: describeBody(error.response?.data),
            /**
             * `true` = a requisição não teve resposta (timeout, DNS, conexão). Para um
             * envio, é a diferença entre "recusado" e "indeterminado" — ver
             * `classifyProviderSendFailure`.
             */
            noResponse: !error.response,
          },
          'Provider falhou',
        )
      }

      throw error
    },
  )
}
