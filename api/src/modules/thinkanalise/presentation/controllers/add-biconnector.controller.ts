import { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { CreateBiConnectorRepository } from '@/modules/thinkanalise/domain/repositories/create-bi-connector.repository'

const addBiconnectorSchema = z.object({
  label: z.string().min(1),
  provider: z.enum(['asaas', 'conta_azul', 'omie']),
  apiKey: z.string().min(1),
})

export class AddBiconnectorController extends Controller {
  constructor(
    private readonly bitrix: BitrixBiConnectorClient,
    private readonly biConnectorRepository: CreateBiConnectorRepository,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { label, provider, apiKey } = addBiconnectorSchema.parse(req.body)
    const base = process.env.THINKANALISE_CALLBACK_URL
    const appId = req.appId

    if (!appId) {
      return this.badRequest(new Error('Invalid request'))
    }

    const result = await this.bitrix.biconnectorAdd({
      title: `[ThinkAnalise] ${label} (${provider})`,
      urlCheck: `${base}/thinkanalise/check`,
      urlData: `${base}/thinkanalise/data`,
      urlTableList: `${base}/thinkanalise/tables`,
      urlTableDescription: `${base}/thinkanalise/describe`,
      settings: [
        { code: 'integration', name: 'Integração', type: 'STRING' },
        { code: 'api_key', name: 'Chave API', type: 'STRING' },
      ],
    })

    await this.biConnectorRepository.createBiConnector({
      appId,
      biconnectorId: result.ID,
      label,
      provider,
      apiKey,
    })

    return this.ok(result)
  }
}
