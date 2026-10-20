import type { RequestHandler } from 'express'
import multer from 'multer'
import { TEMPLATE_SAMPLE_IMAGE_MAX_BYTES } from '@/modules/thinkzap/domain/ports/template-sample-image-fetcher.port'

/**
 * Upload de uma imagem de cabeçalho de template: um arquivo só, em memória (nunca
 * vai para o disco), com o teto da Meta.
 *
 * Pedido JSON passa direto (o multer ignora o que não é multipart). Erro do multer
 * vira `400` com o motivo, no mesmo formato de `Controller.badRequest` — sem isto,
 * arquivo grande demais cairia no handler genérico como `500`.
 */
function makeImageUploadMiddleware(
  field: string,
  tooLargeMessage: string,
): RequestHandler {
  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: TEMPLATE_SAMPLE_IMAGE_MAX_BYTES, files: 1 },
  })

  return (req, res, next) => {
    parser.single(field)(req, res, error => {
      if (error instanceof multer.MulterError) {
        res.status(400).json({
          error:
            error.code === 'LIMIT_FILE_SIZE'
              ? tooLargeMessage
              : `Upload inválido: ${error.message}`,
        })
        return
      }
      next(error)
    })
  }
}

/** Imagem de exemplo na criação de template (`headerImage`). */
export const templateHeaderImageUpload = makeImageUploadMiddleware(
  'headerImage',
  'A imagem de exemplo passa de 5 MB',
)

/** Imagem do cabeçalho escolhida no widget para o envio (`image`). */
export const widgetHeaderImageUpload = makeImageUploadMiddleware(
  'image',
  'A imagem passa de 5 MB',
)
