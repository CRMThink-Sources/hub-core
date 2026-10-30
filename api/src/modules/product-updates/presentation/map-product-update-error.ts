import { httpResponse } from '@/shared/helpers/http'
import {
  CrmthinkTaskNotFoundError,
  CrmthinkTaskResponsibleRequiredError,
  CrmthinkTasksUnavailableError,
  InvalidProductUpdateContentError,
  InvalidProductUpdateImageError,
  ProductUpdateActionRefusedError,
  ProductUpdateImageStorageUnavailableError,
  ProductUpdateIncompleteError,
  ProductUpdateNotFoundError,
  TaskAlreadyLinkedError,
  TasksSyncDisabledError,
} from '../domain/errors/product-update.errors'

/**
 * Tradução HTTP dos erros das novidades no backoffice. Mesmo formato das recusas do
 * portal (`{ error, reason }` dentro de `result`): a tela traduz pelo `reason`, e os
 * campos extras (`missingLocales`, `taskId`, `productUpdateId`, `issues`) são o que
 * ela precisa para apontar o problema.
 *
 * `undefined` = não é erro desta família; quem chama re-lança.
 */
export function mapProductUpdateError(
  error: unknown,
): httpResponse | undefined {
  if (error instanceof ProductUpdateNotFoundError) {
    return { status: 404, result: { error: error.message } }
  }

  if (
    error instanceof ProductUpdateActionRefusedError ||
    error instanceof TasksSyncDisabledError
  ) {
    return refusal(409, error.message, error.reason)
  }
  if (error instanceof TaskAlreadyLinkedError) {
    return refusal(409, error.message, error.reason, {
      taskId: error.taskId,
      productUpdateId: error.productUpdateId,
    })
  }

  if (error instanceof ProductUpdateIncompleteError) {
    return refusal(422, error.message, error.reason, {
      missingLocales: error.missingLocales,
    })
  }
  if (error instanceof InvalidProductUpdateContentError) {
    return refusal(422, error.message, 'invalid-content', {
      issues: error.issues,
    })
  }
  if (error instanceof InvalidProductUpdateImageError) {
    return refusal(422, error.message, 'invalid-image')
  }
  if (error instanceof CrmthinkTaskNotFoundError) {
    return refusal(422, error.message, error.reason, { taskId: error.taskId })
  }
  if (error instanceof CrmthinkTaskResponsibleRequiredError) {
    return refusal(422, error.message, error.reason)
  }

  if (error instanceof CrmthinkTasksUnavailableError) {
    return refusal(502, error.message, error.reason)
  }
  if (error instanceof ProductUpdateImageStorageUnavailableError) {
    return refusal(503, error.message, 'image-storage-unavailable')
  }

  return undefined
}

const refusal = (
  status: number,
  message: string,
  reason: string,
  extra: Record<string, unknown> = {},
): httpResponse => ({ status, result: { error: message, reason, ...extra } })
