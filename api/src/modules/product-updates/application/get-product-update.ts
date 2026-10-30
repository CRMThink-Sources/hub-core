import type { ProductUpdate } from '../domain/entities/product-update'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import { loadProductUpdate } from './helpers/product-update-actions'

/** Detalhe para a edição. A resposta HTTP sai de `toProductUpdateView`. */
export class GetProductUpdate {
  constructor(private readonly repository: ProductUpdateRepository) {}

  execute(id: string): Promise<ProductUpdate> {
    return loadProductUpdate(this.repository, id)
  }
}
