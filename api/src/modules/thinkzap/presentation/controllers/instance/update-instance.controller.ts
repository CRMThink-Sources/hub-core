import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { UpdateInstanceGateway } from '@/modules/thinkzap/domain/repositories/update-instance.gateway'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { httpResponse } from '@/shared/helpers/http'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { setTimeout } from 'timers/promises'
import z from 'zod'

export class UpdateInstanceController extends Controller {
  constructor(
    private readonly bitrix: BitrixClient,
    private readonly updateInstanceGateway: UpdateInstanceGateway,
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly getInstanceRepository: GetInstanceRepository,
    private readonly getDomainRepository: GetDomainRepository,
  ) {
    super()
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const { id } = req.params
    const params = z
      .object({
        name: z.string().min(1),
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(new Error(params.error.message))
    }

    const { name } = params.data
    const connector = await this.getConnectorRepository.get(id as string)
    if (!connector) {
      return this.notFound(new Error('Connector not found'))
    }
    const instance = await this.getInstanceRepository.getInstance(
      connector.instanceId,
    )
    if (!instance) {
      return this.notFound(new Error('Instance not found'))
    }
    const domain = await this.getDomainRepository.getDomainById(
      instance.domainId,
    )
    if (!domain) {
      return this.notFound(new Error('Domain not found'))
    }

    await this.updateInstanceGateway.update(
      instance.instanceId,
      domain.name + ' | ' + name,
      instance.zApiToken as string,
    )

    return this.ok({ id, name })
  }
}
