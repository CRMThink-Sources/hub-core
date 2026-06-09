import { prisma } from '@/config/prisma'
import { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { env } from '@/config/env'
import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { UpdateInstanceRepository } from '@/modules/thinkzap/domain/repositories/update-instance.repository'
import { mergeConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings.schema'

export type UpdateConnectorEventBindsInput = {
  connectorId: string
  messageUpdateEventEnabled?: boolean
  messageDeleteEventEnabled?: boolean
}

export class UpdateConnectorEventBindsUseCase {
  constructor(
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly getInstanceRepository: GetInstanceRepository,
    private readonly updateInstanceRepository: UpdateInstanceRepository,
  ) {}

  async execute(input: UpdateConnectorEventBindsInput): Promise<void> {
    const connector = await this.getConnectorRepository.get(input.connectorId)
    if (!connector) {
      throw new Error('Connector not found')
    }

    const instance = await this.getInstanceRepository.getInstance(
      connector.instanceId,
    )
    if (!instance) {
      throw new Error('Instance not found')
    }

    const app = await prisma.app.findUnique({
      where: { id: connector.appId },
      include: { credential: true, domain: true },
    })
    if (!app || !app.credential || !app.credential.accessToken) {
      throw new Error('App credentials not found')
    }

    const bitrixClient = new BitrixRestClient(
      app.domain.name,
      app.credential.accessToken,
    )

    const webhookUrl = env.bitrix.webhookUrl
    if (!webhookUrl) {
      throw new Error('Webhook URL not configured')
    }

    if (input.messageUpdateEventEnabled !== undefined) {
      const method = input.messageUpdateEventEnabled
        ? 'event.bind'
        : 'event.unbind'
      await bitrixClient.callMethod(method, {
        event: 'ONIMCONNECTORMESSAGEUPDATE',
        handler: webhookUrl,
        auth_type: '0',
      })
    }

    if (input.messageDeleteEventEnabled !== undefined) {
      const method = input.messageDeleteEventEnabled
        ? 'event.bind'
        : 'event.unbind'
      await bitrixClient.callMethod(method, {
        event: 'ONIMCONNECTORMESSAGEDELETE',
        handler: webhookUrl,
        auth_type: '0',
      })
    }

    const updatedSettings = mergeConnectorSettings(instance.settings, {
      ...(input.messageUpdateEventEnabled !== undefined && {
        messageUpdateEventEnabled: input.messageUpdateEventEnabled,
      }),
      ...(input.messageDeleteEventEnabled !== undefined && {
        messageDeleteEventEnabled: input.messageDeleteEventEnabled,
      }),
    })

    await this.updateInstanceRepository.updateSettings(
      instance.id,
      updatedSettings,
    )
  }
}
