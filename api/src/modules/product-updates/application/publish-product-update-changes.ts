import type { ProductUpdate } from '../domain/entities/product-update'
import { hasPendingChanges } from '../domain/entities/product-update'
import { cloneProductUpdateContent } from '../domain/entities/product-update-content'
import { ProductUpdateActionRefusedError } from '../domain/errors/product-update.errors'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import {
  ProductUpdateActionInput,
  assertComplete,
  loadProductUpdate,
  logProductUpdateAction,
} from './helpers/product-update-actions'

/**
 * "Publicar alterações": o cliente passa a ver a versão em edição. Situação e
 * `availableAt` não mudam. `publishedAt` também não: ele ordena a aba "Em breve", e
 * corrigir um texto não deve reordenar a lista. `publishedBy` registra quem publicou.
 */
export class PublishProductUpdateChanges {
  constructor(private readonly repository: ProductUpdateRepository) {}

  async execute(input: ProductUpdateActionInput): Promise<ProductUpdate> {
    const update = await loadProductUpdate(this.repository, input.id)

    if (update.visibility !== 'PUBLISHED') {
      throw new ProductUpdateActionRefusedError('not-published')
    }
    if (!hasPendingChanges(update)) {
      throw new ProductUpdateActionRefusedError('no-pending-changes')
    }
    assertComplete(update)

    const saved = await this.repository.save({
      ...update,
      publishedContent: cloneProductUpdateContent(update.content),
      publishedBy: input.portalUserId,
    })

    logProductUpdateAction('publish-changes', saved, input.portalUserId)
    return saved
  }
}
