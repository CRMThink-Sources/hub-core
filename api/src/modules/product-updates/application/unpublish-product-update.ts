import type { ProductUpdate } from '../domain/entities/product-update'
import { ProductUpdateActionRefusedError } from '../domain/errors/product-update.errors'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import {
  ProductUpdateActionInput,
  loadProductUpdate,
  logProductUpdateAction,
} from './helpers/product-update-actions'

/**
 * Despublicar: volta a rascunho e some para o cliente. `availableAt` e
 * `firstPublishedAt` ficam — republicar como disponível volta com a data original, e
 * a novidade continua sem poder ser excluída. `publishedContent` também fica (o
 * cliente só lê publicadas; a próxima publicação o sobrescreve).
 */
export class UnpublishProductUpdate {
  constructor(private readonly repository: ProductUpdateRepository) {}

  async execute(input: ProductUpdateActionInput): Promise<ProductUpdate> {
    const update = await loadProductUpdate(this.repository, input.id)

    if (update.visibility !== 'PUBLISHED') {
      throw new ProductUpdateActionRefusedError('not-published')
    }

    const saved = await this.repository.save({ ...update, visibility: 'DRAFT' })

    logProductUpdateAction('unpublish', saved, input.portalUserId)
    return saved
  }
}
