import { httpResponse } from '@/shared/helpers/http'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { Controller } from '@/shared/presentation/controller'
import { ListDestinationsService } from '@/modules/thinkzap/application/list-destinations.service'
import { Request, Response } from 'express'
import z from 'zod'

export class ListDestinationsController extends Controller {
  private readonly listDestinationsService: ListDestinationsService

  constructor(private readonly bitrix: BitrixClient) {
    super()
    this.listDestinationsService = new ListDestinationsService(this.bitrix)
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const params = z
      .object({
        contextId: z.string(),
        placement: z.string(),
      })
      .parse(req.query)

    const { destinations, entity } =
      await this.listDestinationsService.execute(params)

    return this.ok({
      destinations,
      entity,
    })
  }
}
