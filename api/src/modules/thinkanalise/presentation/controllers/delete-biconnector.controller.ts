import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixClient } from '@/modules/thinkanalise/infra/clients/bi-biulder.client'

export class DeleteBiconnectorController extends Controller {
  constructor(private readonly bitrix: BitrixClient) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const id = Number(req.params.id)
    const result = await this.bitrix.biconnectorDelete(id)
    return this.ok(result)
  }
}
