import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { CallbackController } from '@/shared/presentation/callback-controller'
import { apiLogger } from '@/shared/infra/logger'
import {
  thinkanaliseError,
  logThinkanaliseError,
} from '@/modules/thinkanalise/errors/catalog'
import { schema as asaasSchema } from './schemas/asaas'
import { schema as blingSchema } from './schemas/bling'
import { schema as contaAzulSchema } from './schemas/conta-azul'
import { schema as omieSchema } from './schemas/omie'
import { schema as sonaxSchema } from './schemas/sonax'

type DescribeBody = {
  name: string
  connection?: {
    integration?: string
    api_key?: string
  }
}

const schemaByProvider: Record<
  string,
  Record<string, { code: string; name: string; type: string }[]>
> = {
  asaas: asaasSchema,
  bling: blingSchema,
  conta_azul: contaAzulSchema,
  omie: omieSchema,
  sonax: sonaxSchema,
}

export class DescribeController extends CallbackController {
  perform(req: Request, _res: Response): Promise<httpResponse> {
    const { name, connection } = req.body as DescribeBody

    if (!name) throw thinkanaliseError('thinkanalise.callback.name_missing')

    const integration = connection?.integration
    const providerSchema = integration
      ? schemaByProvider[integration]
      : undefined
    if (integration && !providerSchema) {
      logThinkanaliseError(
        apiLogger,
        'thinkanalise.callback.provider_unsupported',
        {
          provider: integration,
        },
      )
    }
    const fields = (providerSchema ?? {})[name] ?? []
    return Promise.resolve(this.ok(fields))
  }
}
