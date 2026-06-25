import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { DeleteBiConnectorRepository } from '@/modules/thinkanalise/domain/repositories/delete-bi-connector.repository'
import { apiLogger } from '@/shared/infra/logger'
import { z } from 'zod'

export class DeleteBiconnectorController extends Controller {
  constructor(
    private readonly bitrix: BitrixBiConnectorClient,
    private readonly repository: DeleteBiConnectorRepository,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const biconnectorId = z.coerce
      .number()
      .int()
      .positive()
      .parse(req.params.id)
    await this.repository.deleteBiConnector(biconnectorId)
    await this.bitrix.biconnectorDelete(biconnectorId)

    apiLogger.info(
      { app: 'thinkanalise', biconnectorId },
      'Conector removido',
    )

    return this.ok(true)
  }
}
