import { ListContactsService } from '@/modules/thinkzap/application/list-contacts.service'
import { httpResponse } from '@/shared/helpers/http'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import z from 'zod'

export class ListContactsController extends Controller {
  private readonly listContactsService: ListContactsService

  constructor(private readonly bitrix: BitrixClient) {
    super()
    this.listContactsService = new ListContactsService(this.bitrix)
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const params = z
      .object({
        search: z.string().default(''),
      })
      .parse(req.query)

    const result = await this.listContactsService.execute(params.search)
    return this.ok(result)
  }
}
