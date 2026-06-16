import { prisma } from '@/config/prisma'
import { env } from '@/config/env'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import {
  ThinkzapInstanceNoTokenError,
  ThinkzapInstanceNotFoundError,
} from './subscribe-thinkzap-instance'

export async function unsubscribeThinkzapInstance(
  instanceDbId: string,
): Promise<void> {
  const instance = await prisma.instance.findUnique({
    where: { id: instanceDbId },
  })

  if (!instance) throw new ThinkzapInstanceNotFoundError()
  if (!instance.zApiToken) throw new ThinkzapInstanceNoTokenError()

  const client = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)
  await client.unsubscribe(instance.instanceId, instance.zApiToken)
}
