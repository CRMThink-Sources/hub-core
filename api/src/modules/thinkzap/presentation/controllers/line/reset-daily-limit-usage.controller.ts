import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { ResetDailyLimitUsage } from '@/modules/thinkzap/application/reset-daily-limit-usage'
import { mapLineError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { parseLineRequest } from './line-request'

/**
 * `POST /api/thinkzap/lines/:itemId/daily-limit/reset` — zera o uso de hoje (contagem
 * e extras). Devolve o uso atualizado, para a tela não precisar reler.
 */
export class ResetDailyLimitUsageController extends Controller {
  constructor(private readonly resetDailyLimitUsage: ResetDailyLimitUsage) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)

    try {
      const dailyLimit = await this.resetDailyLimitUsage.execute({
        ...input,
        bitrixUserId: req.bitrixUserId,
      })
      return this.ok({ dailyLimit })
    } catch (error) {
      return mapLineError(error, 'Falha ao zerar o uso de hoje')
    }
  }
}
