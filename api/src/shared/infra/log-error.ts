import {
  isAppError,
  type AppError,
  type ErrorCategory,
} from '@/shared/domain/errors/app-error'

// Saída idêntica nas 3 vias: o MCP lê o errorCode daqui.
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

// `causeErrorCode`: o processor já logou o code; repetir em `errorCode` contaria duas vezes.
export function jobFailureLogFields(err: unknown): Record<string, unknown> {
  return isAppError(err)
    ? { causeErrorCode: err.errorCode, category: err.category, err }
    : { errorCode: 'UNCLASSIFIED', err }
}

export function appErrorLogFields(
  error: AppError,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return errorLogFields(error, { err: error.cause ?? error, ...extra })
}
