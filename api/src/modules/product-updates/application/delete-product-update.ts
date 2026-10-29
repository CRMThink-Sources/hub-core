import { ProductUpdateActionRefusedError } from '../domain/errors/product-update.errors'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import {
  ProductUpdateActionInput,
  loadProductUpdate,
  logProductUpdateAction,
} from './helpers/product-update-actions'

/**
 * Exclui um rascunho que nunca foi publicado. Uma novidade que o cliente já viu
 * (`firstPublishedAt`) só pode ser despublicada. A imagem fica no R2 (sem limpeza
 * de órfãs).
 */
export class DeleteProductUpdate {
  constructor(private readonly repository: ProductUpdateRepository) {}

  async execute(input: ProductUpdateActionInput): Promise<void> {
    const update = await loadProductUpdate(this.repository, input.id)

    if (update.firstPublishedAt) {
      throw new ProductUpdateActionRefusedError('published-before')
    }

    await this.repository.delete(update.id)
    logProductUpdateAction('delete', update, input.portalUserId)
  }
}
