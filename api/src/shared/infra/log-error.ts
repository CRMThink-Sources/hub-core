import type { AppError, ErrorCategory } from '@/shared/domain/errors/app-error'

// Campos estruturados de erro pro Loki. Saída idêntica nas 3 vias — o MCP só lê o errorCode.
export type ErrorLogFields = {
  errorCode: string
  category: ErrorCategory
  remediation: string
  retriable: boolean
}

export function errorLogFields(
  fields: ErrorLogFields,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    errorCode: fields.errorCode,
    category: fields.category,
    remediation: fields.remediation,
    retriable: fields.retriable,
    ...extra,
  }
}

/** Atalho pra AppError (via A): reaproveita os campos + anexa o err cru serializado. */
export function appErrorLogFields(
  error: AppError,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return errorLogFields(error, { err: error.cause ?? error, ...extra })
}
