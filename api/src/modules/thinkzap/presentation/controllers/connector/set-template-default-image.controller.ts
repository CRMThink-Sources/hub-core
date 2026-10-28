import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import z from 'zod'

import { SetTemplateDefaultImageUseCase } from '@/modules/thinkzap/application/set-template-default-image'
import { parseLineRequest } from '../line/line-request'
import { handleTemplateWriteError } from './template-write-errors'

const paramsSchema = z.object({
  name: z.string().min(1),
  language: z.string().min(1),
})

/** Link em JSON, ou multipart com o arquivo em `image` (sem outros campos). */
const bodySchema = z.object({ imageUrl: z.string().optional() }).passthrough()

/**
 * `PUT /thinkzap/lines/:itemId/templates/:name/:language/default-image` — define a
 * imagem padrão do envio de um template com cabeçalho de imagem.
 */
export class SetTemplateDefaultImageController extends Controller {
  constructor(private readonly useCase: SetTemplateDefaultImageUseCase) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const params = paramsSchema.safeParse(req.params)
    const body = bodySchema.safeParse(req.body ?? {})
    if (!params.success || !body.success) {
      return this.badRequest(new Error('Invalid request'))
    }

    try {
      const result = await this.useCase.execute({
        ...parseLineRequest(req),
        name: params.data.name,
        language: params.data.language,
        ...(body.data.imageUrl ? { imageUrl: body.data.imageUrl } : {}),
        ...(req.file ? { imageFile: { data: req.file.buffer } } : {}),
      })
      return this.ok(result)
    } catch (error) {
      return handleTemplateWriteError.call(this, error)
    }
  }
}
