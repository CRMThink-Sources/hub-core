import { prisma } from '@/config/prisma'
import { env } from '@/config/env'
import { parseConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings.schema'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'

export type ThinkzapInstanceItem = {
  connectorId: string
  connectorStatus: string
  instanceDbId: string
  instanceId: string
  vinculatedChannel: string | null
  status: string | null
  messageUpdateEventEnabled: boolean
  messageDeleteEventEnabled: boolean
  zapiName: string | null
  zapiConnected: boolean | null
  zapiPaymentStatus: string | null
}

export type ListThinkzapInstancesForAppOutput = {
  instances: ThinkzapInstanceItem[]
}

export async function listThinkzapInstancesForApp(
  appId: string,
): Promise<ListThinkzapInstancesForAppOutput> {
  const connectors = await prisma.connector.findMany({
    where: { appId },
    include: { instance: true },
    orderBy: { createdAt: 'asc' },
  })

  const activeConnectors = connectors.filter(c => c.instance !== null)

  const client = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)

  const zapiResults = await Promise.all(
    activeConnectors.map(async c => {
      const instance = c.instance!
      if (!instance.zApiToken) return null
      try {
        return await client.getInstance(instance.instanceId, instance.zApiToken)
      } catch {
        return null
      }
    }),
  )

  return {
    instances: activeConnectors.map((c, i) => {
      const instance = c.instance!
      const settings = parseConnectorSettings(instance.settings ?? {})
      const zapi = zapiResults[i]
      return {
        connectorId: c.id,
        connectorStatus: c.status,
        instanceDbId: instance.id,
        instanceId: instance.instanceId,
        vinculatedChannel: instance.vinculatedChannel,
        status: instance.status,
        messageUpdateEventEnabled: settings.messageUpdateEventEnabled,
        messageDeleteEventEnabled: settings.messageDeleteEventEnabled,
        zapiName: zapi?.name ?? null,
        zapiConnected: zapi?.connected ?? null,
        zapiPaymentStatus: zapi?.paymentStatus ?? null,
      }
    }),
  }
}
