import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixAppOptionService } from '@/shared/application/bitrix-app-option.service'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ThinkzapDisconnectNotifySettingsService } from '../../application/thinkzap-disconnect-notify-settings.service'

export class GetDisconnectNotifySettingsController extends Controller {
  constructor(private readonly bitrix: BitrixClient) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) {
      return this.badRequest(new Error('App context not found'))
    }

    const service = new ThinkzapDisconnectNotifySettingsService(
      new BitrixAppOptionService(this.bitrix),
      appId,
    )
    return this.ok({ userIds: await service.get() })
  }
}
