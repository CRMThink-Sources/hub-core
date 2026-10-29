import type { ProductUpdate } from '../domain/entities/product-update'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import {
  ProductUpdateActionInput,
  loadProductUpdate,
  logProductUpdateAction,
} from './helpers/product-update-actions'

/**
 * Tira a imagem da versão em edição. Não apaga o objeto no R2 (pode estar no
 * snapshot publicado) e não depende do R2 estar configurado.
 */
export class RemoveProductUpdateImage {
  constructor(private readonly repository: ProductUpdateRepository) {}

  async execute(input: ProductUpdateActionInput): Promise<ProductUpdate> {
    const update = await loadProductUpdate(this.repository, input.id)
    if (update.content.imageKey === null) return update

    const saved = await this.repository.save({
      ...update,
      content: { ...update.content, imageKey: null },
    })

    logProductUpdateAction('remove-image', saved, input.portalUserId)
    return saved
  }
}
