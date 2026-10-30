import type { ProductUpdate } from '../domain/entities/product-update'
import { parseProductUpdateTexts } from '../domain/entities/product-update-content'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import {
  ProductUpdateActionInput,
  loadProductUpdate,
  logProductUpdateAction,
} from './helpers/product-update-actions'

export type UpdateProductUpdateContentInput = ProductUpdateActionInput & {
  /** Os três idiomas, substituídos por inteiro. A imagem tem ações próprias. */
  texts: unknown
}

/**
 * Salva os textos da versão em edição. Em qualquer situação: numa novidade
 * publicada, só `content` muda — `publishedContent` (o que o cliente vê) espera
 * "Publicar alterações".
 */
export class UpdateProductUpdateContent {
  constructor(private readonly repository: ProductUpdateRepository) {}

  async execute(
    input: UpdateProductUpdateContentInput,
  ): Promise<ProductUpdate> {
    const texts = parseProductUpdateTexts(input.texts)
    const update = await loadProductUpdate(this.repository, input.id)

    const saved = await this.repository.save({
      ...update,
      content: { ...texts, imageKey: update.content.imageKey },
    })

    logProductUpdateAction('update-content', saved, input.portalUserId)
    return saved
  }
}
