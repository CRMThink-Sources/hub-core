import { TEMPLATE_SAMPLE_IMAGE_MAX_BYTES } from '@/modules/thinkzap/domain/ports/template-sample-image-fetcher.port'
import {
  StoredTemplateImage,
  TemplateImageStorage,
  TemplateImageStorageUnavailableError,
} from '@/modules/thinkzap/domain/ports/template-image-storage.port'
import { sniffTemplateImageType } from '@/modules/thinkzap/domain/template-header'
import { apiLogger } from '@/shared/infra/logger'

/** Arquivo recusado antes de chegar ao armazenamento; a mensagem vai ao operador. */
export class InvalidWidgetHeaderImageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidWidgetHeaderImageError'
  }
}

export type UploadWidgetTemplateHeaderImageInput = {
  data: Buffer
  domainId: string
  /** Do JWT, para o log de quem subiu. */
  bitrixUserId?: string
}

/**
 * Hospeda a imagem do cabeçalho escolhida no widget e devolve a URL pública que o
 * envio do template usa em `headerImageUrl`.
 *
 * As travas são as da imagem de exemplo da criação: até 5 MB e JPEG/PNG pela
 * assinatura. Nada é gravado quando o arquivo não serve.
 */
export class UploadWidgetTemplateHeaderImageUseCase {
  constructor(private readonly storage: TemplateImageStorage | null) {}

  async execute(
    input: UploadWidgetTemplateHeaderImageInput,
  ): Promise<StoredTemplateImage> {
    if (input.data.length > TEMPLATE_SAMPLE_IMAGE_MAX_BYTES) {
      throw new InvalidWidgetHeaderImageError('A imagem passa de 5 MB')
    }
    const contentType = sniffTemplateImageType(input.data)
    if (!contentType) {
      throw new InvalidWidgetHeaderImageError(
        'A imagem precisa ser um arquivo JPEG ou PNG',
      )
    }
    if (!this.storage) {
      throw new TemplateImageStorageUnavailableError('storage not configured')
    }

    const stored = await this.storage.store({
      data: input.data,
      contentType,
      scope: { domainId: input.domainId },
    })

    apiLogger.info(
      {
        app: 'thinkzap',
        domainId: input.domainId,
        bitrixUserId: input.bitrixUserId,
        size: input.data.length,
        contentType,
        key: stored.key,
      },
      'imagem do cabeçalho do widget hospedada',
    )

    return stored
  }
}
