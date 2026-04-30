import { httpResponse } from '@/shared/helpers/http'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'

export class ListOpenChannelsController extends Controller {
  constructor(private readonly bitrix: BitrixClient) {
    super()
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const openChannels = await this.bitrix.getOpenChannels()

    const params = {
      channels: openChannels.result.map(el => ({
        id: el.ID,
        active: el.ACTIVE === 'Y',
        name: el.LINE_NAME,
      })),
      total: openChannels.result.length,
    }

    return this.ok(params)
  }
}
