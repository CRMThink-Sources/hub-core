/** Instalação de app não existe em `core_apps`. */
export class AplicationNotFoundError extends Error {
  constructor(aplicationId: string) {
    super(`Aplicação "${aplicationId}" não encontrada`)
    this.name = 'AplicationNotFoundError'
  }
}
