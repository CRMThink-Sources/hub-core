import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import z from 'zod'
import { GetConnectorRepository } from '../../domain/repositories/get-connector.repository'
import { BitrixOAuthClient } from '@/shared/infra/clients/bitrix-oauth.client'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

export class VinculateChannelController extends Controller {
  constructor(
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly bitrixClient: BitrixClient,
  ) {
    super()
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const params = z
      .object({
        connectorId: z.string(),
        lineId: z.number(),
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const { connectorId, lineId } = params.data

    const connector = await this.getConnectorRepository.get(connectorId)

    if (!connector) {
      return this.notFound(new Error('Connector not found'))
    }

    await this.bitrixClient.activateConnector(lineId)

    return this.ok({ message: 'Vinculate channel' })
  }
}
