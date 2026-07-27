import { prisma } from '@/config/prisma'
import { env } from '@/config/env'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import {
  ThinkzapInstanceNoTokenError,
  ThinkzapInstanceNotFoundError,
} from './subscribe-thinkzap-instance'

export async function unsubscribeThinkzapInstance(
  instanceDbId: string,
): Promise<void> {
  const instance = await prisma.instance.findUnique({
    where: { id: instanceDbId },
    include: { connector: true },
  })

  if (!instance) throw new ThinkzapInstanceNotFoundError()

  if (instance.connector?.provider === 'HUBMESSAGE') {
    const channelId = instance.channelId ?? instance.instanceId
    const client = new HubMessageClient({
      baseUrl: env.hubMessage.baseUrl,
      token: env.hubMessage.secretKey,
    })
    await client.cancelChannel(channelId, 'Cancelamento de assinatura')
    return
  }

  if (!instance.zApiToken) throw new ThinkzapInstanceNoTokenError()
  const client = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)
  await client.unsubscribe(instance.instanceId, instance.zApiToken)
}
