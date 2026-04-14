import { env } from '@/config/env'
import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { UpdateInstanceRepository } from '@/modules/thinkzap/domain/repositories/update-instance.repository'
import { httpResponse } from '@/shared/helpers/http'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import z from 'zod'

export class DisconnectChannelController extends Controller {
  constructor(
    private readonly bitrixClient: BitrixClient,
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly instanceRepository: GetInstanceRepository &
      UpdateInstanceRepository,
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

    const instance = await this.instanceRepository.getInstance(
      connector.instanceId,
    )
    if (!instance) {
      return this.notFound(new Error('Instance not found'))
    }

    await this.bitrixClient.activateConnector(
      lineId,
      env.bitrix.connector.code,
      0,
    )

    await this.instanceRepository.updateVinculatedChannel(instance.id, null)

    return this.ok({ message: 'Channel disconnected successfully' })
  }
}
