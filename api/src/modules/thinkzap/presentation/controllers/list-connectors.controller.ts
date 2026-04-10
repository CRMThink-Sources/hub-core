import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { ListConnectorsRepository } from '../../domain/repositories/list-connectors'
import { CollectConnectorToInstance } from '../../main/map-connector-to-instance'
import { z } from 'zod'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { Connector } from '../../domain/entities/connector'

export class ListConnectorsController extends Controller {
  constructor(
    private readonly listConnectors: ListConnectorsRepository,
    private readonly getApp: GetInstalledAppRepository,
  ) {
    super()
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const { domainId, appCodeId } = z
      .object({
        domainId: z.string(),
        appCodeId: z.string(),
      })
      .parse(req.body)

    if (!domainId || !appCodeId) {
      const app = await this.getApp.getByAppCodeAndDomainId(appCodeId, domainId)
      if (!app) {
        return this.badRequest(new Error('App not found'))
      }

      const connectors = await this.listConnectors.listConnectors(app.id)
      const promises = CollectConnectorToInstance(connectors)
      const response = (await Promise.all(promises)) as Connector[]
      return this.ok({ connectors: response, total: connectors.length })
    } else {
      return this.badRequest(new Error('Invalid request'))
    }
  }
}
