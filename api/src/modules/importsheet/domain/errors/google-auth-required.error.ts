/**
 * Sinaliza que a conexão Google precisa ser (re)feita: sem conexão, refresh_token
 * revogado/expirado, ou 401 persistente do Google. Mapeado para HTTP 401 na borda.
 */
export class GoogleAuthRequiredError extends Error {
  constructor(message = 'Reconecte a conta Google nas Configurações.') {
    super(message)
    this.name = 'GoogleAuthRequiredError'
  }
}
