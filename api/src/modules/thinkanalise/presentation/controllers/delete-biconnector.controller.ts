import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { z } from 'zod'

export class DeleteBiconnectorController extends Controller {
  constructor(private readonly bitrix: BitrixBiConnectorClient) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const id = z.number().parse(req.params.id)
    if (!id) {
      return this.badRequest(new Error('Invalid request'))
    }
    const result = await this.bitrix.biconnectorDelete(id)
    return this.ok(result)
  }
}
