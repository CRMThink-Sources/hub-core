import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { ListConnectorsRepository } from '../../domain/repositories/list-connectors'
import { GetOrCreateInstalledApp } from '@/shared/application/get-or-create-installed-app'
import { CollectConnectorToInstance } from '../../main/map-connector-to-instance'

export class ListConnectorsController extends Controller {
  constructor(
    private readonly listConnectors: ListConnectorsRepository,
    private readonly getApp: GetOrCreateInstalledApp,
  ) {
    super()
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const app = await this.getApp.execute({
      domainId: req.domainId as string,
      appCodeId: req.appId as string,
    })

    const connectors = await this.listConnectors.listConnectors(app.id)
    const promises = CollectConnectorToInstance(connectors)
    const response = await Promise.all(promises)
    return this.ok({ connectors: response, total: connectors.length })
  }
}
