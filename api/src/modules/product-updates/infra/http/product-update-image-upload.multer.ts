import type { RequestHandler } from 'express'
import multer from 'multer'
import { PRODUCT_UPDATE_IMAGE_MAX_BYTES } from '../../domain/ports/product-update-image-storage.port'

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg'])

/** Recusa do `fileFilter`, distinta dos `MulterError` de limite. */
class UnsupportedImageTypeError extends Error {}

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PRODUCT_UPDATE_IMAGE_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, accept) => {
    if (ACCEPTED_TYPES.has(file.mimetype)) {
      accept(null, true)
      return
    }
    accept(new UnsupportedImageTypeError())
  },
})

/**
 * Upload da imagem de uma novidade (campo `image`): um arquivo só, em memória, até
 * 5 MB, PNG ou JPEG.
 *
 * O tipo declarado pelo navegador barra cedo o caso comum (GIF, PDF); a assinatura
 * do arquivo é conferida de novo no caso de uso, que é a trava de verdade. Arquivo
 * recusado vira `422` com o motivo, no formato `{ error, reason }` das recusas do
 * backoffice — sem isto cairia no handler genérico como `500`.
 */
export const productUpdateImageUpload: RequestHandler = (req, res, next) => {
  parser.single('image')(req, res, error => {
    if (error instanceof UnsupportedImageTypeError) {
      res.status(422).json({
        error: 'A imagem precisa ser um arquivo PNG ou JPEG',
        reason: 'invalid-image-type',
      })
      return
    }
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE'
      res.status(422).json({
        error: tooLarge
          ? 'A imagem passa de 5 MB'
          : `Upload inválido: ${error.message}`,
        reason: tooLarge ? 'image-too-large' : 'invalid-upload',
      })
      return
    }
    next(error)
  })
}
