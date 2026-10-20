import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { ReleaseDailyLimitExtra } from '@/modules/thinkzap/application/release-daily-limit-extra'
import { mapLineError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { parseLineRequest } from './line-request'

const bodySchema = z.object({ amount: z.number().int().positive() }).strict()

/**
 * `POST /api/thinkzap/lines/:itemId/daily-limit/extra` — soma mensagens extras ao
 * limite **de hoje**. Devolve o uso atualizado, para a tela não precisar reler.
 */
export class ReleaseDailyLimitExtraController extends Controller {
  constructor(private readonly releaseDailyLimitExtra: ReleaseDailyLimitExtra) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)
    const body = bodySchema.safeParse(req.body)

    if (!body.success) {
      return this.badRequest(
        new Error('Invalid request: ' + body.error.message),
      )
    }

    try {
      const dailyLimit = await this.releaseDailyLimitExtra.execute({
        ...input,
        amount: body.data.amount,
      })
      return this.ok({ dailyLimit })
    } catch (error) {
      return mapLineError(error, 'Falha ao liberar o limite temporário')
    }
  }
}
