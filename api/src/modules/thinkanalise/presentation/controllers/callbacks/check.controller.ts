import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { CallbackController } from '@/shared/presentation/callback-controller'

export class CheckController extends CallbackController {
  perform(req: Request, _res: Response): Promise<httpResponse> {
    const body = req.body as Record<string, unknown>
    const settings =
      (body.connection as Record<string, string> | undefined) ??
      (body as Record<string, string>)

    if (!settings?.api_key || !settings?.integration) {
      return Promise.resolve(
        this.badRequest(new Error('Missing connection parameters')),
      )
    }

    return Promise.resolve(this.ok({ ok: true }))
  }
}
