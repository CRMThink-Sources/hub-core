/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BitrixWebhookContext,
  GetBitrixWebhookContextRepository,
} from '@/modules/thinkzap/domain/repositories/get-bitrix-webhook-context.repository'
import { prisma } from '@/config/prisma.js'

export class PrismaBitrixWebhookContextRepository implements GetBitrixWebhookContextRepository {
  async getContext(params: {
    domainName: string
    appCode: string
    line: string
  }): Promise<BitrixWebhookContext | null> {
    const context = await prisma.domain.findFirst({
      where: { name: params.domainName },
      include: {
        apps: {
          where: { appCodeId: params.appCode },
          include: { credential: true },
          take: 1,
        },
        instances: {
          where: { vinculatedChannel: params.line },
          take: 1,
        },
      },
    })

    if (!context) return null
    return toBitrixWebhookContext(context)
  }
}

const toBitrixWebhookContext = (context: any): BitrixWebhookContext => {
  const app = context.apps[0]
  const instance = context.instances[0]
  if (!app || !instance) {
    throw new Error('App or instance not found')
  }
  return {
    id: context.id,
    name: context.name,
    memberId: context.memberId,
    app: {
      id: app.id,
      domainId: app.domainId,
      appCodeId: app.appCodeId,
      status: app.status,
      credential: app.credential,
    },
    instance: {
      instanceId: instance.instanceId,
      zApiToken: instance.zApiToken,
      id: instance.id,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
      vinculatedChannel: instance.vinculatedChannel,
      domainId: instance.domainId,
      status: instance.status,
    },
  }
}
