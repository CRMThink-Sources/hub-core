import { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { CreateBiConnectorParams } from '@/shared/infra/clients/types/biconnector'
import { CreateBiConnectorRepository } from '@/modules/thinkanalise/domain/repositories/create-bi-connector.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { env } from '@/config/env'
import { apiLogger } from '@/shared/infra/logger'

const addBiconnectorSchema = z.object({
  label: z.string().min(1),
  provider: z.enum(['asaas', 'bling', 'conta_azul', 'omie', 'sonax']),
})

const providerDescription: Record<string, string> = {
  asaas: 'Asaas',
  bling: 'Bling',
  conta_azul: 'Conta Azul',
  omie: 'Omie',
  sonax: 'Sonax',
}

export class AddBiconnectorController extends Controller {
  constructor(
    private readonly bitrix: BitrixBiConnectorClient,
    private readonly biConnectorRepository: CreateBiConnectorRepository,
    private readonly getApp: GetInstalledAppRepository,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { label, provider } = addBiconnectorSchema.parse(req.body)
    const url = env.apiUrl

    const appCodeId = req.appId
    const domainId = req.domainId

    if (!appCodeId || !domainId) {
      return this.badRequest(new Error('Invalid request'))
    }

    const app = await this.getApp.getByAppCodeAndDomainId(appCodeId, domainId)
    if (!app) {
      return this.badRequest(new Error('App not found'))
    }

    const params: CreateBiConnectorParams = {
      title: `[Think Hub] ${label}`,
      logo: 'https://cdn-icons-png.flaticon.com/512/2329/2329087.png',
      description: `Conector Think Hub — integração com ${providerDescription[provider] ?? provider}`,
      urlCheck: `${url}/thinkanalise/check`,
      urlData: `${url}/thinkanalise/data`,
      urlTableList: `${url}/thinkanalise/tables`,
      urlTableDescription: `${url}/thinkanalise/describe`,
      settings: [
        { code: 'integration', name: 'Integração', type: 'STRING' },
        { code: 'api_key', name: 'Chave API', type: 'STRING' },
      ],
    }

    const result = await this.bitrix.biconnectorAdd(params)

    if (!result?.id) {
      return this.badRequest(new Error('Bitrix did not return a connector ID'))
    }

    await this.biConnectorRepository.createBiConnector({
      appId: app.id,
      biconnectorId: result.id,
      label,
      provider,
      apiKey: '',
    })

    apiLogger.info(
      {
        app: 'thinkanalise',
        appId: app.id,
        biconnectorId: result.id,
        provider,
      },
      'Conector criado',
    )

    return this.ok(result)
  }
}
