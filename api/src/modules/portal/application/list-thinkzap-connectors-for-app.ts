import { prisma } from '@/config/prisma'
import { parseConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings.schema'

export type ThinkzapConnectorItem = {
  id: string
  instanceId: string
  vinculatedChannel: string | null
  messageUpdateEventEnabled: boolean
  messageDeleteEventEnabled: boolean
}

export type ListThinkzapConnectorsOutput = {
  connectors: ThinkzapConnectorItem[]
}

export async function listThinkzapConnectorsForApp(
  appId: string,
): Promise<ListThinkzapConnectorsOutput> {
  const connectors = await prisma.connector.findMany({
    where: { appId, status: { not: 'INACTIVE' } },
    include: { instance: true },
    orderBy: { createdAt: 'asc' },
  })

  return {
    connectors: connectors.map(c => {
      const settings = parseConnectorSettings(c.instance?.settings ?? {})
      return {
        id: c.id,
        instanceId: c.instance?.instanceId ?? '',
        vinculatedChannel: c.instance?.vinculatedChannel ?? null,
        messageUpdateEventEnabled: settings.messageUpdateEventEnabled,
        messageDeleteEventEnabled: settings.messageDeleteEventEnabled,
      }
    }),
  }
}
