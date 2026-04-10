import { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { CreateBiConnectorParams } from '@/shared/infra/clients/types/biconnector'

const addBiconnectorSchema = z.object({
  label: z.string().min(1),
  provider: z.enum(['asaas', 'conta_azul', 'omie']),
  apiKey: z.string().min(1),
})

export class AddBiconnectorController extends Controller {
  constructor(private readonly bitrix: BitrixBiConnectorClient) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { label, provider, apiKey } = addBiconnectorSchema.parse(req.body)
    const base = process.env.THINKANALISE_CALLBACK_URL

    const params: CreateBiConnectorParams = {
      title: `[ThinkAnalise] ${label}`,
      urlCheck: `${base}/thinkanalise/check`,
      urlData: `${base}/thinkanalise/data`,
      urlTableList: `${base}/thinkanalise/tables`,
      urlTableDescription: `${base}/thinkanalise/describe`,
      settings: [
        { code: 'integration', name: 'Integração', type: 'STRING' },
        { code: 'api_key', name: 'Chave API', type: 'STRING' },
      ],
    }

    const result = await this.bitrix.biconnectorAdd(params)

    return this.ok(result)
  }
}
