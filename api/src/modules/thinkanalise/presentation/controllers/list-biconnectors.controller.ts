import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { ListBiConnectorRepository } from '@/modules/thinkanalise/domain/repositories/list-bi-connector.repository'

export class ListBiconnectorsController extends Controller {
  constructor(private readonly repository: ListBiConnectorRepository) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.appId
    if (!appId) {
      return this.badRequest(new Error('Invalid request'))
    }
    const result = await this.repository.listBiConnectors(appId)
    return this.ok(result)
  }
}
