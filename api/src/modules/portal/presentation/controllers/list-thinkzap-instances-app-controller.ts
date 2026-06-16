import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { listThinkzapInstancesForApp } from '../../application/list-thinkzap-instances-for-app'

export class ListThinkzapInstancesAppController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { appId } = req.params as { appId: string }

    const output = await listThinkzapInstancesForApp(appId)
    return this.ok(output)
  }
}
