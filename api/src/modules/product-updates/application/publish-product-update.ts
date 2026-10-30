import type { ProductUpdate } from '../domain/entities/product-update'
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
 * Publica um rascunho em "Em breve": o cliente passa a ver o snapshot da versão em
 * edição. Concluída ou não — uma concluída aparece como "Aguardando revisão" no
 * backoffice e segue em "Em breve" para o cliente.
 *
 * Rascunho com `availableAt` (já foi disponível e foi despublicado) é recusado:
 * publicá-lo assim o levaria direto a "Já disponível", e esse caminho é só
 * "Publicar como disponível".
 */
export class PublishProductUpdate {
  constructor(
    private readonly repository: ProductUpdateRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(input: ProductUpdateActionInput): Promise<ProductUpdate> {
    const update = await loadProductUpdate(this.repository, input.id)

    if (update.visibility === 'PUBLISHED') {
      throw new ProductUpdateActionRefusedError('already-published')
    }
    if (update.availableAt) {
      throw new ProductUpdateActionRefusedError('previously-available')
    }
    assertComplete(update)

    const now = this.now()
    const saved = await this.repository.save({
      ...update,
      visibility: 'PUBLISHED',
      publishedContent: cloneProductUpdateContent(update.content),
      publishedAt: now,
      publishedBy: input.portalUserId,
      firstPublishedAt: update.firstPublishedAt ?? now,
    })

    logProductUpdateAction('publish', saved, input.portalUserId)
    return saved
  }
}
