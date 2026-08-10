import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { CallbackController } from '@/shared/presentation/callback-controller'
import { AsaasClient } from '@/shared/infra/clients/asaas.client'
import { AsaasDataService } from '@/modules/thinkanalise/infra/asaas-data.service'
import { ContaAzulClient } from '@/shared/infra/clients/conta-azul.client'
import { ContaAzulDataService } from '@/modules/thinkanalise/infra/conta-azul-data.service'
import {
  SonaxClient,
  parseSonaxCredentials,
} from '@/shared/infra/clients/sonax.client'
import { SonaxDataService } from '@/modules/thinkanalise/infra/sonax-data.service'
import {
  OmieClient,
  parseOmieCredentials,
} from '@/shared/infra/clients/omie.client'
import { OmieDataService } from '@/modules/thinkanalise/infra/omie-data.service'
import { BlingClient } from '@/shared/infra/clients/bling.client'
import { BlingDataService } from '@/modules/thinkanalise/infra/bling-data.service'
import { thinkAnaliseAuthTokenService } from '@/modules/thinkanalise/infra/auth-token.service'
import { thinkanaliseError } from '@/modules/thinkanalise/errors/catalog'
import { classifyProviderError } from '@/modules/thinkanalise/errors/classify-provider-error'

type DataBody = {
  table: string
  select: string[]
  filter?: Record<string, unknown>
  limit?: number | string
  mapFields?: Record<string, string>
  connection: {
    integration: string
    api_key: string
  }
}

type DataService = { fetch: AsaasDataService['fetch'] }

export class DataController extends CallbackController {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { table, select, limit, mapFields, filter, connection } =
      req.body as DataBody

    if (!table || !connection?.api_key || !connection?.integration) {
      throw thinkanaliseError('thinkanalise.callback.connection_missing')
    }

    const maxRows = Number(limit) || 1000
    const { integration, api_key } = connection

    let service: DataService

    if (integration === 'asaas') {
      service = new AsaasDataService(new AsaasClient(api_key))
    } else if (integration === 'conta_azul') {
      const { accessToken, accountId } =
        await thinkAnaliseAuthTokenService.getAccessToken('conta_azul', api_key)
      service = new ContaAzulDataService(
        new ContaAzulClient(accessToken, accountId),
        async () => {
          const refreshed = await thinkAnaliseAuthTokenService.getAccessToken(
            'conta_azul',
            api_key,
            true,
          )
          return refreshed.accessToken
        },
      )
    } else if (integration === 'sonax') {
      const { idCliente, token } = parseSonaxCredentials(api_key)
      service = new SonaxDataService(new SonaxClient(idCliente, token))
    } else if (integration === 'omie') {
      const { appKey, appSecret } = parseOmieCredentials(api_key)
      service = new OmieDataService(new OmieClient(appKey, appSecret))
    } else if (integration === 'bling') {
      const { accessToken } = await thinkAnaliseAuthTokenService.getAccessToken(
        'bling',
        api_key,
      )
      service = new BlingDataService(new BlingClient(accessToken))
    } else {
      throw thinkanaliseError('thinkanalise.callback.provider_unsupported')
    }

    try {
      const data = await service.fetch(
        table,
        select ?? [],
        mapFields ?? {},
        maxRows,
        filter ?? {},
      )
      return this.ok(data)
    } catch (error) {
      throw classifyProviderError(error)
    }
  }
}
