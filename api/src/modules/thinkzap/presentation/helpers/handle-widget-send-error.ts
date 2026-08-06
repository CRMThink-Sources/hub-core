import { httpResponse } from '@/shared/helpers/http'
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { LineDisconnectedError } from '@/modules/thinkzap/domain/errors/line-disconnected.error'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import { mapLineBlockedError } from './handle-line-error'

/**
 * Tradução de erro do envio pelo widget (`send-widget` e `send-widget-multipart`).
 *
 * Compartilhado porque os dois controllers duplicavam o mesmo `try/catch` e, com a
 * ordem habilitação → conexão → provider agora observável, responder diferente por
 * rota faria o widget ter que aprender cada uma.
 *
 * `mapLineError` não serve aqui: ele traduz falha de leitura do provider para `502`,
 * e no envio a falha do provider continua sendo `badRequest` com a mensagem crua —
 * é o comportamento que o front já sabe mostrar por `thinkzapApiErrorMessage`.
 */
export function mapWidgetSendError(error: unknown): httpResponse {
  const message =
    error instanceof Error ? error.message : 'Failed to send message'

  /**
   * Antes de tudo: a linha existe e o escopo já foi conferido, então nada abaixo dá
   * resposta melhor que "seu teste acabou". `402` com `code: 'line-blocked'`, o mesmo
   * das rotas de linha — antes este caminho caía no `badRequest` genérico e o front
   * perdia a distinção que `extractLineBlocked` criou.
   */
  if (error instanceof LineBlockedError) {
    return mapLineBlockedError(error)
  }

  /**
   * `409` e não `402`: o direito existe, o estado é que não permite enviar agora. O
   * `code` no corpo porque a mensagem é interpolada com o id do item, e comparar
   * texto no front nunca casaria.
   */
  if (error instanceof LineDisconnectedError) {
    return {
      status: 409,
      result: {
        error: error.message,
        code: 'line-disconnected',
      },
    }
  }

  /** Item fora da árvore da instalação do token — indistinguível de inexistente. */
  if (error instanceof LineNotFoundError) {
    return { status: 404, result: { error: message } }
  }

  /** Linha HubMessage: `send-widget` continua Z-API-only. */
  if (error instanceof LineProviderNotSupportedError) {
    return { status: 400, result: { error: message } }
  }

  /**
   * Preservado do `try/catch` que estes controllers tinham: `Connector`/`Instance`
   * ainda lançam `Error` cru com estas mensagens em caminhos que não passaram para
   * erro de domínio.
   */
  if (message === 'Connector not found' || message === 'Instance not found') {
    return { status: 404, result: { error: message } }
  }

  /** Resto — incluindo falha do provider — segue como `400` com a mensagem atual. */
  return { status: 400, result: { error: message } }
}
