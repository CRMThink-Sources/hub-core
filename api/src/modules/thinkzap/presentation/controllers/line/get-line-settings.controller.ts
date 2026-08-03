import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetLineSettings } from '@/modules/thinkzap/application/get-line-settings'
import { mapLineSettingsToView } from '@/modules/thinkzap/presentation/mappers/line-settings.mapper'
import { mapLineError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { parseLineRequest } from './line-request'

/** `GET /api/thinkzap/lines/:itemId/settings` — ajustes persistidos da linha. */
export class GetLineSettingsController extends Controller {
  constructor(private readonly getLineSettings: GetLineSettings) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)

    try {
      const reading = await this.getLineSettings.execute(input)
      return this.ok(mapLineSettingsToView(reading))
    } catch (error) {
      return mapLineError(error, 'Falha ao ler os ajustes da linha')
    }
  }
}
