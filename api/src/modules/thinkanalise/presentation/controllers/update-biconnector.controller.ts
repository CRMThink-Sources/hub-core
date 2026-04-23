import { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { UpdateBiConnectorRepository } from '@/modules/thinkanalise/domain/repositories/update-bi-connector.repository'

const updateBiconnectorSchema = z.object({
  label: z.string().min(1).optional(),
})

export class UpdateBiconnectorController extends Controller {
  constructor(
    private readonly bitrix: BitrixBiConnectorClient,
    private readonly repository: UpdateBiConnectorRepository,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const biconnectorId = z.coerce
      .number()
      .int()
      .positive()
      .parse(req.params.id)
    const { label } = updateBiconnectorSchema.parse(req.body)

    if (label) {
      await this.bitrix.biconnectorUpdate(biconnectorId, {
        title: `[ThinkAnalise] ${label}`,
      })
    }

    await this.repository.updateBiConnector(biconnectorId, { label })

    return this.ok(true)
  }
}
