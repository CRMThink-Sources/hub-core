import { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { ThinkAnaliseAuthTokenService } from '../../infra/auth-token.service'
import { apiLogger } from '@/shared/infra/logger'

export class DeleteSourceController extends Controller {
  constructor(
    private readonly bitrix: BitrixBiConnectorClient,
    private readonly authTokenService: ThinkAnaliseAuthTokenService,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const id = z.coerce.number().int().positive().parse(req.params.id)
    await this.bitrix.sourceDelete(id)
    await this.authTokenService.deleteByBitrixSourceId(id)

    apiLogger.info({ app: 'thinkanalise', sourceId: id }, 'Fonte removida')

    return this.ok(true)
  }
}
