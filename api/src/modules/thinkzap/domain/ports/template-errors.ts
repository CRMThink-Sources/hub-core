/** Provider do conector ainda não suporta templates (ex.: Z-API). */
export class TemplatesNotSupportedError extends Error {
  constructor(provider: string) {
    super(`Provider "${provider}" não suporta gestão de templates`)
    this.name = 'TemplatesNotSupportedError'
  }
}

/** Conector não está apto a gerenciar templates (sem WABA associada). */
export class ConnectorNotTemplateCapableError extends Error {
  constructor(connectorId: string) {
    super(
      `Conector "${connectorId}" não está apto a gerenciar templates (WABA ausente)`,
    )
    this.name = 'ConnectorNotTemplateCapableError'
  }
}
