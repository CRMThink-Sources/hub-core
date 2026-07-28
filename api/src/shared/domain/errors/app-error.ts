export type ErrorCategory =
  | 'integration'
  | 'auth'
  | 'validation'
  | 'internal'
  | 'config'

// errorCode espelha o caminho do runbook (mcp/kb/runbooks/<app>/<area>/<causa>.md):
// é a chave que casa log ↔ runbook ↔ MCP. Estável, nunca renomear (é contrato).
export class AppError extends Error {
  constructor(
    readonly errorCode: string,
    readonly category: ErrorCategory,
    readonly userCause: string, // linguagem de suporte; vira Error.message + msg do log
    readonly remediation: string,
    readonly httpStatus = 500,
    readonly retriable = false,
    readonly cause?: unknown,
  ) {
    super(userCause)
    this.name = new.target.name
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
