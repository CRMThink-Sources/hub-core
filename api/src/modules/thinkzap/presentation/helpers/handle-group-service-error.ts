import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import { httpResponse } from '@/shared/helpers/http'
import { mapLineBlockedError } from './handle-line-error'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'
import { AppError } from '@/shared/domain/errors/app-error'

// Discrimina por classe, não por texto: as mensagens são interpoladas.
export function mapGroupServiceError(
  error: unknown,
  fallbackMessage: string,
): httpResponse {
  const message = error instanceof Error ? error.message : fallbackMessage

  // Id fora da instalação do token é indistinguível de id inexistente.
  if (error instanceof LineNotFoundError) {
    logThinkzapError(
      apiLogger,
      'thinkzap.subscription.line_not_found_for_item',
      { app: 'thinkzap', err: error },
      { level: 'warn' },
    )
    return { status: 404, result: { error: message } }
  }

  // Mesma resposta das rotas de linha; o 400 genérico faria a tela tratar como entrada inválida.
  if (error instanceof LineBlockedError) {
    return mapLineBlockedError(error)
  }

  // 400 e não 404: a linha existe, a operação de grupo é que não se aplica.
  if (error instanceof LineProviderNotSupportedError) {
    logThinkzapError(
      apiLogger,
      'thinkzap.line.provider_unsupported',
      { app: 'thinkzap', err: error },
      { level: 'warn' },
    )
    return { status: 400, result: { error: message } }
  }

  // Já catalogado (z-api, 502): o funil loga o code e responde o status certo.
  if (error instanceof AppError) throw error

  return { status: 400, result: { error: message } }
}
