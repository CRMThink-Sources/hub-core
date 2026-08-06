/**
 * Linha existe, mas não é Z-API — não há credencial Z-API a resolver.
 *
 * `400` e não `404`: o recurso existe, o que não se aplica é a operação. O
 * WhatsApp Oficial (`HUBMESSAGE`) tem a sua própria superfície de configuração.
 */
export class LineProviderNotSupportedError extends Error {
  constructor(provider: string) {
    super(`Operação indisponível para linha do provider "${provider}"`)
    this.name = 'LineProviderNotSupportedError'
  }
}
