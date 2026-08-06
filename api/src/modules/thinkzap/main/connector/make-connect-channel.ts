import { env } from '@/config/env'
import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import { ConnectChannelController } from '../../presentation/controllers/connector/connect-channel.controller'
import { PrismaConnectorRepository } from '../../infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstanceRepository } from '../../infra/persistence/repositories/prisma-instance.repository'
import { HubMessageClient } from '../../infra/clients/hubmessage.client'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { makeSubscriptionItemRepository } from '@/modules/application/main/make-subscription-item-repository'

export const makeConnectChannelController = (
  _req: Request,
): Promise<Controller> => {
  const hubMessageClient = new HubMessageClient({
    baseUrl: env.hubMessage.baseUrl,
    token: env.hubMessage.secretKey,
  })
  const getConnectorRepository = new PrismaConnectorRepository()
  const instanceRepository = new PrismaInstanceRepository()

  return Promise.resolve(
    new ConnectChannelController(
      hubMessageClient,
      getConnectorRepository,
      instanceRepository,
      env.hubMessage.webhookUrl,
      makeGetAplicationContext(),
      /**
       * O repositório de itens entra porque é aqui que a WABA passa a existir para o
       * produto: o provisionamento cria só o canal, e o item da linha precisa dela.
       */
      makeSubscriptionItemRepository(),
    ),
  )
}
