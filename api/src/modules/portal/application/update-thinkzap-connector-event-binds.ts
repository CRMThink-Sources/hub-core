import { prisma } from '@/config/prisma'
import { env } from '@/config/env'
import {
  parseConnectorSettings,
  mergeConnectorSettings,
} from '@/modules/thinkzap/domain/value-objects/connector-settings.schema'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type UpdateThinkzapConnectorEventBindsInput = {
  appId: string
  connectorId: string
  messageUpdateEventEnabled?: boolean
  messageDeleteEventEnabled?: boolean
}

export async function updateThinkzapConnectorEventBinds(
  input: UpdateThinkzapConnectorEventBindsInput,
): Promise<void> {
  const connector = await prisma.connector.findFirst({
    where: { id: input.connectorId, appId: input.appId },
    include: { instance: true },
  })

  if (!connector) {
    throw new Error('Connector not found')
  }

  if (!connector.instance) {
    throw new Error('Instance not found')
  }

  const { client } = await resolveBitrixClientForApp(input.appId)

  const webhookUrl = env.bitrix.webhookUrl
  if (!webhookUrl) {
    throw new Error('Webhook URL not configured')
  }

  if (input.messageUpdateEventEnabled !== undefined) {
    const method = input.messageUpdateEventEnabled
      ? 'event.bind'
      : 'event.unbind'
    await client.callMethod(method, {
      event: 'ONIMCONNECTORMESSAGEUPDATE',
      handler: webhookUrl,
      auth_type: '0',
    })
  }

  if (input.messageDeleteEventEnabled !== undefined) {
    const method = input.messageDeleteEventEnabled
      ? 'event.bind'
      : 'event.unbind'
    await client.callMethod(method, {
      event: 'ONIMCONNECTORMESSAGEDELETE',
      handler: webhookUrl,
      auth_type: '0',
    })
  }

  const currentSettings = parseConnectorSettings(
    connector.instance.settings ?? {},
  )
  const updatedSettings = mergeConnectorSettings(currentSettings, {
    ...(input.messageUpdateEventEnabled !== undefined && {
      messageUpdateEventEnabled: input.messageUpdateEventEnabled,
    }),
    ...(input.messageDeleteEventEnabled !== undefined && {
      messageDeleteEventEnabled: input.messageDeleteEventEnabled,
    }),
  })

  await prisma.instance.update({
    where: { id: connector.instance.id },
    data: { settings: updatedSettings },
  })
}
