import { prisma } from '@/config/prisma'
import { env } from '@/config/env'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'

export class ThinkzapInstanceNoTokenError extends Error {
  constructor() {
    super('Instância sem token configurado')
    this.name = 'ThinkzapInstanceNoTokenError'
  }
}

export class ThinkzapInstanceNotFoundError extends Error {
  constructor() {
    super('Instância não encontrada')
    this.name = 'ThinkzapInstanceNotFoundError'
  }
}

export async function subscribeThinkzapInstance(
  instanceDbId: string,
): Promise<void> {
  const instance = await prisma.instance.findUnique({
    where: { id: instanceDbId },
  })

  if (!instance) throw new ThinkzapInstanceNotFoundError()
  if (!instance.zApiToken) throw new ThinkzapInstanceNoTokenError()

  const client = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)
  await client.subscribe(instance.instanceId, instance.zApiToken)
}
