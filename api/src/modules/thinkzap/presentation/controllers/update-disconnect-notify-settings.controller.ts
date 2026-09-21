import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixAppOptionService } from '@/shared/application/bitrix-app-option.service'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ThinkzapDisconnectNotifySettingsService } from '../../application/thinkzap-disconnect-notify-settings.service'

const bodySchema = z.object({
  userIds: z.array(z.number().int()),
})

export class UpdateDisconnectNotifySettingsController extends Controller {
  constructor(private readonly bitrix: BitrixClient) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) {
      return this.badRequest(new Error('App context not found'))
    }

    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) {
      return this.badRequest(new Error('userIds deve ser um array de inteiros'))
    }

    const service = new ThinkzapDisconnectNotifySettingsService(
      new BitrixAppOptionService(this.bitrix),
      appId,
    )
    const userIds = await service.set(parsed.data.userIds)
    return this.ok({ userIds })
  }
}
