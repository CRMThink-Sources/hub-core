import { env } from '@/config/env'
import { CreateInstanceGateway } from '@/modules/thinkzap/domain/repositories/create-instance.gateway'
import { UpdateInstanceGateway } from '@/modules/thinkzap/domain/repositories/update-instance.gateway'
import { CreateZApiInstanceResponse } from '@/modules/thinkzap/infra/clients/types/z-api.types'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'

export class ZApiInstanceGateway
  implements CreateInstanceGateway, UpdateInstanceGateway
{
  constructor(private readonly zApiClient: ZApiClient) {}

  async create(name: string): Promise<CreateZApiInstanceResponse> {
    const instance = await this.zApiClient.createInstance({
      name,
      sessionName: name,
      deliveryCallbackUrl: env.zApi.callbackUrl,
      receivedCallbackUrl: env.zApi.callbackUrl,
      disconnectedCallbackUrl: env.zApi.callbackUrl,
      connectedCallbackUrl: env.zApi.callbackUrl,
      messageStatusCallbackUrl: env.zApi.callbackUrl,
    })

    return instance
  }

  async update(id: string, name: string, token: string): Promise<void> {
    await this.zApiClient.updateInstance(id, name, token)
  }
}
