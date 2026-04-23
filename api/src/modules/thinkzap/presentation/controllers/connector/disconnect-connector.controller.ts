import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import z from 'zod'

export class DisconnectConnectorController extends Controller {
  constructor(
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly instanceRepository: GetInstanceRepository,
    private readonly zApiClient: ZApiClient,
  ) {
    super()
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const params = z
      .object({
        connectorId: z.string(),
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const { connectorId } = params.data

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

    if (!instance.zApiToken) {
      return this.badRequest(new Error('Instance token not found'))
    }

    await this.zApiClient.disconnectInstance(
      instance.instanceId,
      instance.zApiToken,
    )

    return this.ok({ message: 'Connector disconnected successfully' })
  }
}
