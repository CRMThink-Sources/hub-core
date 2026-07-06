import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { CallbackController } from '@/shared/presentation/callback-controller'
import { schema as asaasSchema } from './schemas/asaas'
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
  conta_azul: contaAzulSchema,
  omie: omieSchema,
  sonax: sonaxSchema,
}

export class DescribeController extends CallbackController {
  perform(req: Request, _res: Response): Promise<httpResponse> {
    const { name, connection } = req.body as DescribeBody

    if (!name) {
      return Promise.resolve(this.badRequest(new Error('Missing table name')))
    }

    const integration = connection?.integration
    const providerSchema =
      (integration ? schemaByProvider[integration] : undefined) ?? {}
    const fields = providerSchema[name] ?? []
    return Promise.resolve(this.ok(fields))
  }
}
