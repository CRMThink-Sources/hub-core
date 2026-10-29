import type { ProductUpdate } from '../domain/entities/product-update'
import { productUpdateSituation } from '../domain/entities/product-update'
import { cloneProductUpdateContent } from '../domain/entities/product-update-content'
import { ProductUpdateActionRefusedError } from '../domain/errors/product-update.errors'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import {
  Clock,
  ProductUpdateActionInput,
  assertComplete,
  loadProductUpdate,
  logProductUpdateAction,
} from './helpers/product-update-actions'

/**
 * "Publicar como disponível": o único caminho para "Já disponível", e sempre um passo
 * humano — concluir (aqui ou no Bitrix) nunca publica.
 *
 * Exige `DONE`. Vale a partir de rascunho (direto para disponível, sem passar por
 * "Em breve") ou de uma publicada pendente de revisão. A data de disponibilidade é o
 * momento da ação, a menos que já exista: despublicar a mantém, e republicar volta
 * com a data original.
 */
export class PublishProductUpdateAsAvailable {
  constructor(
    private readonly repository: ProductUpdateRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(input: ProductUpdateActionInput): Promise<ProductUpdate> {
    const update = await loadProductUpdate(this.repository, input.id)

    if (productUpdateSituation(update) === 'available') {
      throw new ProductUpdateActionRefusedError('already-available')
    }
    if (update.progress !== 'DONE') {
      throw new ProductUpdateActionRefusedError('not-done')
    }
    assertComplete(update)

    const now = this.now()
    const saved = await this.repository.save({
      ...update,
      visibility: 'PUBLISHED',
      availableAt: update.availableAt ?? now,
      publishedContent: cloneProductUpdateContent(update.content),
      publishedAt: now,
      publishedBy: input.portalUserId,
      firstPublishedAt: update.firstPublishedAt ?? now,
    })

    logProductUpdateAction('publish-as-available', saved, input.portalUserId)
    return saved
  }
}
