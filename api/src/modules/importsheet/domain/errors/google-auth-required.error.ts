import { AppError } from '@/shared/domain/errors/app-error'

// Conexão Google precisa ser (re)feita: sem conexão, refresh_token revogado, ou 401 do Google.
export class GoogleAuthRequiredError extends AppError {
  constructor(
    userCause = 'Reconecte a conta Google nas Configurações.',
    cause?: unknown,
  ) {
    super(
      'importsheet.google.auth_required',
      'auth',
      userCause,
      'Orientar o parceiro a reconectar a conta Google (com acesso às planilhas) nas Configurações.',
      401,
      false,
      cause,
    )
  }
}
