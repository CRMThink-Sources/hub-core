import { sniffTemplateImageType } from '@/modules/thinkzap/domain/template-header'
import type { ProductUpdate } from '../domain/entities/product-update'
import {
  InvalidProductUpdateImageError,
  ProductUpdateImageStorageUnavailableError,
} from '../domain/errors/product-update.errors'
import {
  PRODUCT_UPDATE_IMAGE_MAX_BYTES,
  ProductUpdateImageStorage,
} from '../domain/ports/product-update-image-storage.port'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import {
  ProductUpdateActionInput,
  loadProductUpdate,
  logProductUpdateAction,
} from './helpers/product-update-actions'

export type UploadProductUpdateImageInput = ProductUpdateActionInput & {
  /** Ausente quando o pedido chegou sem arquivo. */
  data: Buffer | undefined
}

/**
 * Envia (ou troca) a imagem da versão em edição. Como os textos, numa novidade
 * publicada ela fica pendente até "Publicar alterações". O objeto anterior não é
 * apagado: pode ser o do snapshot publicado.
 *
 * Tipo pela assinatura do arquivo (PNG/JPEG) e até 5 MB; nada é gravado quando o
 * arquivo não serve. Sem R2 configurado, `503`.
 */
export class UploadProductUpdateImage {
  constructor(
    private readonly repository: ProductUpdateRepository,
    private readonly storage: ProductUpdateImageStorage | null,
  ) {}

  async execute(input: UploadProductUpdateImageInput): Promise<ProductUpdate> {
    const update = await loadProductUpdate(this.repository, input.id)

    if (!input.data?.length) {
      throw new InvalidProductUpdateImageError('Envie um arquivo de imagem')
    }
    if (input.data.length > PRODUCT_UPDATE_IMAGE_MAX_BYTES) {
      throw new InvalidProductUpdateImageError('A imagem passa de 5 MB')
    }
    const contentType = sniffTemplateImageType(input.data)
    if (!contentType) {
      throw new InvalidProductUpdateImageError(
        'A imagem precisa ser um arquivo PNG ou JPEG',
      )
    }
    if (!this.storage) {
      throw new ProductUpdateImageStorageUnavailableError(
        'storage not configured',
      )
    }

    const stored = await this.storage.store({ data: input.data, contentType })

    const saved = await this.repository.save({
      ...update,
      content: { ...update.content, imageKey: stored.key },
    })

    logProductUpdateAction('upload-image', saved, input.portalUserId)
    return saved
  }
}
