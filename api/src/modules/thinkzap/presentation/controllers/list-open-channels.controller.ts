import { httpResponse } from '@/shared/helpers/http'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { toOpenChannelList } from '@/modules/thinkzap/application/helpers/to-open-channel-list'

export class ListOpenChannelsController extends Controller {
  constructor(private readonly bitrix: BitrixClient) {
    super()
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const openChannels = await this.bitrix.getOpenChannels()
    const rows = toOpenChannelList(openChannels.result)

    const params = {
      channels: rows.map(el => ({
        id: el.ID,
        // `ACTIVE` ausente conta como ativo: `config.list.get` não devolve o campo em
        // toda versão de portal, e `=== 'Y'` escondia todos os canais.
        active: el.ACTIVE !== 'N',
        name: el.LINE_NAME,
      })),
      total: rows.length,
    }

    return this.ok(params)
  }
}
