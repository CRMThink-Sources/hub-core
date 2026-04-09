import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixClient } from '../../infra/clients/bi-biulder.client'

export class ListBiconnectorsController extends Controller {
  constructor(private readonly bitrix: BitrixClient) {
    super()
  }

  async perform(_req: Request, _res: Response): Promise<httpResponse> {
    const result = await this.bitrix.biconnectorList()
    return this.ok(result)
  }
}
