import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import { httpResponse } from '@/shared/helpers/http'

/**
 * Traduz a falha de uma operação de grupo em resposta HTTP.
 *
 * A discriminação é por **classe** de erro, não por texto da mensagem: as
 * mensagens de `LineNotFoundError` e `LineProviderNotSupportedError` são
 * interpoladas com o id e o provider, então comparar strings nunca casaria e
 * todo erro de resolução caía em `400`.
 */
export function mapGroupServiceError(
  error: unknown,
  fallbackMessage: string,
): httpResponse {
  const message = error instanceof Error ? error.message : fallbackMessage

  /** Id fora da instalação do token é indistinguível de id inexistente. */
  if (error instanceof LineNotFoundError) {
    return { status: 404, result: { error: message } }
  }

  /**
   * `400` e não `404`: a linha existe (HubMessage, por exemplo), o que não se
   * aplica é a operação de grupo. Mesma regra vale para linha desconectada.
   */
  if (error instanceof LineProviderNotSupportedError) {
    return { status: 400, result: { error: message } }
  }

  return { status: 400, result: { error: message } }
}
