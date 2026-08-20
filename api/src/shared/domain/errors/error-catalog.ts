import type { Logger } from 'pino'
import { AppError, type ErrorCategory } from './app-error'
import { errorLogFields } from '@/shared/infra/log-error'

// Metadados de um errorCode. httpStatus só importa na via A (exceção → funil HTTP).
export type ErrorMeta = {
  category: ErrorCategory
  userCause: string // = summary do runbook (linguagem de suporte)
  remediation: string
  retriable: boolean
  httpStatus?: number
}

// Monta o catálogo de erros de um app: a factory de AppError (via A) e o emissor
// de log estruturado (via B/C), tipados no conjunto de codes. Ver os catálogos
// por app em modules/<app>/errors/catalog.ts.
export function makeErrorCatalog<T extends Record<string, ErrorMeta>>(
  errors: T,
) {
  type Code = keyof T & string

  function appError(code: Code, cause?: unknown): AppError {
    const m = errors[code]!
    return new AppError(
      code,
      m.category,
      m.userCause,
      m.remediation,
      m.httpStatus ?? 500,
      m.retriable,
      cause,
    )
  }

  function logError(
    logger: Logger,
    code: Code,
    extra?: Record<string, unknown>,
    opts?: { level?: 'warn' | 'error'; msg?: string },
  ): void {
    const m = errors[code]!
    const level = opts?.level ?? 'warn'
    logger[level](
      errorLogFields(
        {
          errorCode: code,
          category: m.category,
          remediation: m.remediation,
          retriable: m.retriable,
        },
        extra,
      ),
      opts?.msg ?? m.userCause,
    )
  }

  return { appError, logError }
}
