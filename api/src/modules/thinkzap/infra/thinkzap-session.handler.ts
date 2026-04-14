/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { env } from '@/config/env'

import {
  SessionHanderPerformer,
  SessionHandler,
} from '@/modules/auth/infra/session-registry'
import { PrismaConnectorRepository } from './persistence/repositories/prisma-connector.repository'
import { ZApiClient } from './clients/z-api.client'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'

export class ThinkzapSessionHandler implements SessionHandler {
  appCode = 'crmthink.thinkzap'

  handlers: SessionHanderPerformer[] = [
    {
      perform: async <T>(params: { appId: string }): Promise<T> => {
        const connectorRepository = new PrismaConnectorRepository()
        const bx = await makeBitrixClientByAppId(params.appId)
        console.log({ bx })

        const zApiClient = new ZApiClient(
          env.zApi.partnerToken,
          env.zApi.clientToken,
        )

        const connectors = await connectorRepository.listConnectors(
          params.appId,
          true,
        )

        const mappedConnectors = await Promise.all(
          connectors.map(async connector => {
            const instance = await zApiClient.getInstance(
              connector.instance?.instanceId ?? '',
              connector.instance?.zApiToken ?? '',
            )
            const phoneData = await zApiClient.getPhoneData(
              connector.instance?.instanceId ?? '',
              connector.instance?.zApiToken ?? '',
            )

            const data: any = {
              ...connector,
              instance: {
                ...connector.instance,
                name: instance.name,
                connected: instance.connected,
                paidStatus: instance.paymentStatus,
                due: instance.due,
                phoneNumber: phoneData?.phone,
              },
            }

            if (connector.instance?.vinculatedChannel) {
              const openChannel = await bx.getOpenChannel(
                connector.instance?.vinculatedChannel,
              )
              if (openChannel?.LINE_NAME) {
                data.instance.vinculatedChannelName = openChannel.LINE_NAME
                return data
              }
            }
            return data
          }),
        )

        return { key: 'connectors', data: mappedConnectors } as T
      },
    },
  ]
}
