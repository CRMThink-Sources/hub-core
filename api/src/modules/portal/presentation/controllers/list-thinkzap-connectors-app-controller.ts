import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { listThinkzapConnectorsForApp } from '../../application/list-thinkzap-connectors-for-app'

export class ListThinkzapConnectorsAppController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { appId } = req.params

    if (!appId || typeof appId !== 'string') {
      return this.badRequest(new Error('Invalid app id'))
    }

    const output = await listThinkzapConnectorsForApp(appId)
    return this.ok(output)
  }
}
