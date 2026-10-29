import type { ProductUpdate } from '../domain/entities/product-update'
import { hasPendingChanges } from '../domain/entities/product-update'
import { cloneProductUpdateContent } from '../domain/entities/product-update-content'
import { ProductUpdateActionRefusedError } from '../domain/errors/product-update.errors'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import {
  ProductUpdateActionInput,
  loadProductUpdate,
  logProductUpdateAction,
} from './helpers/product-update-actions'

/** "Descartar alterações": a versão em edição volta a ser a publicada (texto e imagem). */
export class DiscardProductUpdateChanges {
  constructor(private readonly repository: ProductUpdateRepository) {}

  async execute(input: ProductUpdateActionInput): Promise<ProductUpdate> {
    const update = await loadProductUpdate(this.repository, input.id)

    if (update.visibility !== 'PUBLISHED' || !update.publishedContent) {
      throw new ProductUpdateActionRefusedError('not-published')
    }
    if (!hasPendingChanges(update)) {
      throw new ProductUpdateActionRefusedError('no-pending-changes')
    }

    const saved = await this.repository.save({
      ...update,
      content: cloneProductUpdateContent(update.publishedContent),
    })

    logProductUpdateAction('discard-changes', saved, input.portalUserId)
    return saved
  }
}
