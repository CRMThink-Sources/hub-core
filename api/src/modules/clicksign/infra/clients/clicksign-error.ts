import axios from 'axios'

export class ClicksignApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly raw?: unknown,
  ) {
    super(message)
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
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    return status ? `${error.message} (status ${status})` : error.message
  }
  if (error instanceof Error) return error.message
  return String(error)
}
