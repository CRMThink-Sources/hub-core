import { apiLogger } from '@/shared/infra/logger'
import type { ProductUpdate } from '../../domain/entities/product-update'
import { productUpdateSituation } from '../../domain/entities/product-update'
import { missingLocales } from '../../domain/entities/product-update-content'
import {
  ProductUpdateIncompleteError,
  ProductUpdateNotFoundError,
} from '../../domain/errors/product-update.errors'
import type { ProductUpdateRepository } from '../../domain/repositories/product-update.repository'

/** Entrada comum das ações do backoffice: a novidade e quem age. */
export type ProductUpdateActionInput = {
  id: string
  /** Sessão do portal (`req.portalUserId`). */
  portalUserId: string
}

export type Clock = () => Date

export async function loadProductUpdate(
  repository: ProductUpdateRepository,
  id: string,
): Promise<ProductUpdate> {
  const update = await repository.findById(id)
  if (!update) throw new ProductUpdateNotFoundError()
  return update
}

/** `422` com os idiomas que faltam; publicar exige os três completos. */
export function assertComplete(update: ProductUpdate): void {
  const missing = missingLocales(update.content)
  if (missing.length) throw new ProductUpdateIncompleteError(missing)
}

/**
 * Trilha de auditoria das ações do backoffice. As colunas guardam só quem criou,
 * publicou e concluiu; edição, despublicação e exclusão ficam no log.
 */
export function logProductUpdateAction(
  action: string,
  update: ProductUpdate,
  portalUserId: string,
): void {
  apiLogger.info(
    {
      app: 'product-updates',
      action,
      productUpdateId: update.id,
      portalUserId,
      situation: productUpdateSituation(update),
    },
    'Ação em novidade do ThinkZap',
  )
}
