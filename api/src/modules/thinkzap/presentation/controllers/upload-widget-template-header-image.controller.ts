import { Request } from 'express'
import {
  InvalidWidgetHeaderImageError,
  UploadWidgetTemplateHeaderImageUseCase,
} from '@/modules/thinkzap/application/upload-widget-template-header-image'
import { TemplateImageStorageUnavailableError } from '@/modules/thinkzap/domain/ports/template-image-storage.port'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'

/**
 * `POST /api/thinkzap/messages/widget-template-header-image` — hospeda a imagem do
 * cabeçalho escolhida no widget e devolve `{ url }`, que o widget manda depois em
 * `headerImageUrl` no envio do template.
 *
 * Bloco do widget: qualquer usuário Bitrix com JWT, como o envio. O domínio vem do
 * token, nunca do corpo.
 */
export class UploadWidgetTemplateHeaderImageController extends Controller {
  constructor(
    private readonly useCase: UploadWidgetTemplateHeaderImageUseCase,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    if (!req.file) {
      return this.badRequest(
        new Error('Envie o arquivo da imagem no campo image'),
      )
    }

    // O middleware de auth do bloco garante o domínio; sem ele não há escopo.
    if (!req.domainId) {
      return this.unauthorized(new Error('Instalação não identificada'))
    }

    try {
      const { url } = await this.useCase.execute({
        data: req.file.buffer,
        domainId: req.domainId,
        bitrixUserId: req.bitrixUserId,
      })
      return this.ok({ url })
    } catch (error) {
      if (error instanceof InvalidWidgetHeaderImageError) {
        logThinkzapError(
          apiLogger,
          'thinkzap.message.widget_header_image_invalid',
          { app: 'thinkzap', err: error },
          { level: 'warn' },
        )
        return this.badRequest(error)
      }
      if (error instanceof TemplateImageStorageUnavailableError) {
        logThinkzapError(
          apiLogger,
          'thinkzap.message.widget_header_image_storage_unavailable',
          { app: 'thinkzap', err: error, detail: error.detail },
          { level: 'error' },
        )
        return {
          status: 503,
          result: {
            error: error.message,
            code: 'header-image-upload-unavailable',
          },
        }
      }
      throw error
    }
  }
}
