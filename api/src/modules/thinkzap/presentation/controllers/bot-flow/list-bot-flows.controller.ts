import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import type { ListBotFlowsRepository } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow.repository'

export class ListBotFlowsController extends Controller {
  constructor(private readonly listFlows: ListBotFlowsRepository) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) {
      return this.badRequest(new Error('App context not found'))
    }

    const flows = await this.listFlows.listByAppId(appId)
    return this.ok({ flows })
  }
}
