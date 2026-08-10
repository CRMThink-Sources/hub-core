import axios from 'axios'
import { AppError } from '@/shared/domain/errors/app-error'
import { CLICKSIGN_ERRORS } from '../../errors/catalog'

// Erro da API Clicksign. É AppError → carrega errorCode clicksign.api.request_failed;
// se bubblar até a borda, o funil loga o code + a mensagem/status da Clicksign (no cause).
export class ClicksignApiError extends AppError {
  constructor(
    readonly providerMessage: string,
    readonly status?: number,
    readonly raw?: unknown,
  ) {
    const m = CLICKSIGN_ERRORS['clicksign.api.request_failed']
    super(
      'clicksign.api.request_failed',
      m.category,
      m.userCause,
      m.remediation,
      m.httpStatus,
      m.retriable,
      { providerMessage, status },
    )
    this.name = 'ClicksignApiError'
  }
}

interface JsonApiErrorBody {
  errors?: Array<{ title?: string; detail?: string }>
}

export function parseClicksignError(error: unknown): ClicksignApiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const body = error.response?.data as JsonApiErrorBody | undefined
    const first = body?.errors?.[0]
    const message = first?.title ?? first?.detail ?? error.message
    return new ClicksignApiError(message, status, body)
  }
  if (error instanceof Error) return new ClicksignApiError(error.message)
  return new ClicksignApiError('Erro desconhecido na Clicksign')
}

// Nunca logar o objeto axios cru: `config.params` carrega o access_token.
export function safeErrorMessage(error: unknown): string {
  // ClicksignApiError.message = userCause genérico; o detalhe útil (msg/status da
  // Clicksign) está em providerMessage — o runbook manda ler justamente isso.
  if (error instanceof ClicksignApiError) {
    return error.status
      ? `${error.providerMessage} (status ${error.status})`
      : error.providerMessage
  }
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    return status ? `${error.message} (status ${status})` : error.message
  }
  if (error instanceof Error) return error.message
  return String(error)
}
