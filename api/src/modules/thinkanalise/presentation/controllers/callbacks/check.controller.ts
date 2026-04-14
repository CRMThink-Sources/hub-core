import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { CallbackController } from '@/shared/presentation/callback-controller'

type CheckBody = {
  connection: {
    integration: string
    api_key: string
  }
}

export class CheckController extends CallbackController {
  perform(req: Request, _res: Response): Promise<httpResponse> {
    const { connection } = req.body as CheckBody

    if (!connection?.api_key || !connection?.integration) {
      return Promise.resolve(
        this.badRequest(new Error('Missing connection parameters')),
      )
    }

    // TODO: validar a api_key contra o provider (connection.integration)
    return Promise.resolve(this.ok({ ok: true }))
  }
}
