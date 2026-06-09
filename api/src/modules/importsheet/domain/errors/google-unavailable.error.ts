export class GoogleUnavailableError extends Error {
  constructor(
    message = 'Tempo limite ao consultar o Google Sheets. Tente novamente em instantes.',
  ) {
    super(message)
    this.name = 'GoogleUnavailableError'
  }
}
