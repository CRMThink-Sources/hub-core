import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { CallbackController } from '@/shared/presentation/callback-controller'
import { AsaasClient } from '@/shared/infra/clients/asaas.client'

export class CheckController extends CallbackController {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const body = req.body as Record<string, unknown>
    const settings =
      (body.connection as Record<string, string> | undefined) ??
      (body as Record<string, string>)

    if (!settings?.api_key || !settings?.integration) {
      return this.badRequest(new Error('Missing connection parameters'))
    }

    if (settings.integration === 'asaas') {
      try {
        const client = new AsaasClient(settings.api_key)
        await client.list('/customers', {}, 1)
      } catch {
        return this.badRequest(new Error('Api key inválida'))
      }
    }

    return this.ok({ ok: true, message: 'Api key OK' })
  }
}
