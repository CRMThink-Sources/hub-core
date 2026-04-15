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
            let phoneData = null
            if (instance.connected) {
              phoneData = await zApiClient.getPhoneData(
                connector.instance?.instanceId ?? '',
                connector.instance?.zApiToken ?? '',
              )
            }

            const data: any = {
              ...connector,
              instance: {
                // ...connector.instance,
                instanceId: connector.instance?.instanceId,
                vinculatedChannel: connector.instance?.vinculatedChannel,
                name: instance.name.includes(' | ')
                  ? instance.name.split(' | ')[1]
                  : instance.name,
                connected: instance.connected,
                paidStatus: instance.paymentStatus,
                due: instance.due,
                phoneNumber: phoneData?.phone ? phoneData.phone : null,
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
