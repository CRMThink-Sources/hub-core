import { AppError } from '@/shared/domain/errors/app-error'

// Google Sheets fora do ar / timeout. Falha temporária → retriable, HTTP 504 na borda.
export class GoogleUnavailableError extends AppError {
  constructor(
    userCause = 'Tempo limite ao consultar o Google Sheets. Tente novamente em instantes.',
    cause?: unknown,
  ) {
    super(
      'importsheet.google.unavailable',
      'integration',
      userCause,
      'Falha temporária do Google — tentar de novo em instantes; se persistir, checar status do Google.',
      504,
      true,
      cause,
    )
  }
}
