import type { RequestHandler } from 'express'
import multer from 'multer'
import { TEMPLATE_SAMPLE_IMAGE_MAX_BYTES } from '@/modules/thinkzap/domain/ports/template-sample-image-fetcher.port'

/**
 * Upload da imagem de exemplo do cabeçalho na criação de template: um arquivo só,
 * em memória (vai direto para o provider, nunca para o disco), com o teto da Meta.
 */
const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TEMPLATE_SAMPLE_IMAGE_MAX_BYTES, files: 1 },
})

/**
 * Pedido JSON passa direto (o multer ignora o que não é multipart). Erro do multer
 * vira `400` com o motivo, no mesmo formato de `Controller.badRequest` — sem isto,
 * arquivo grande demais cairia no handler genérico como `500`.
 */
export const templateHeaderImageUpload: RequestHandler = (req, res, next) => {
  parser.single('headerImage')(req, res, error => {
    if (error instanceof multer.MulterError) {
      res.status(400).json({
        error:
          error.code === 'LIMIT_FILE_SIZE'
            ? 'A imagem de exemplo passa de 5 MB'
            : `Upload inválido: ${error.message}`,
      })
      return
    }
    next(error)
  })
}
