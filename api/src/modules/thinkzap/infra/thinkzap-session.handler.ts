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
import { PrismaBillingSubscriptionRepository } from '@/shared/infra/persistence/repositories/prisma-billing-subscription.repository'
import { parseConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings.schema'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { InstanceStatus } from '@/modules/thinkzap/domain/entities/instance'
import { hubMessageConnectorLabel } from '@/modules/thinkzap/domain/hubmessage-connector-label'
import { makeConnectorProviderResolver } from '@/modules/thinkzap/main/make-connector-provider-resolver'
import { ZApiInstanceGateway } from './persistence/gateway/instance.gateway'

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
        // Resolver único: o adapter HubMessage memoiza `listBusinesses` entre os
        // conectores deste request.
        const providerResolver = makeConnectorProviderResolver({
          zApiClient,
          instanceGateway: new ZApiInstanceGateway(zApiClient),
        })

        const connectors = await connectorRepository.listConnectors(
          params.appId,
          true,
        )

        const mappedConnectors = await Promise.all(
          connectors.map(async connector => {
            const provider = connector.provider ?? ConnectorProvider.ZAPI
            const isHubMessage = provider === ConnectorProvider.HUBMESSAGE
            console.log('isHubMessage', isHubMessage)
            // HubMessage não tem instância Z-API: status e nome saem do banco.
            const remote = isHubMessage
              ? null
              : await zApiClient.getInstance(
                  connector.instance?.instanceId ?? '',
                  connector.instance?.zApiToken ?? '',
                )

            let phoneData = null
            if (remote?.connected) {
              phoneData = await zApiClient.getPhoneData(
                connector.instance?.instanceId ?? '',
                connector.instance?.zApiToken ?? '',
              )
            }

            // HubMessage: status de conexão ao vivo (agregado por WABA), com
            // fallback ao status persistido quando a consulta indisponível.
            let hubMessageConnected =
              connector.instance?.status === InstanceStatus.CONNECTED
            if (isHubMessage) {
              try {
                const status = await providerResolver
                  .resolve(ConnectorProvider.HUBMESSAGE)
                  .getConnectionStatus({
                    instanceId: connector.instanceId,
                    channelId:
                      connector.instance?.channelId ??
                      connector.instance?.instanceId ??
                      null,
                    wabaId: connector.instance?.wabaId ?? null,
                  })
                if (status.available) {
                  hubMessageConnected = status.connected
                }
              } catch (error) {
                console.warn(
                  '[ThinkzapSessionHandler] HubMessage status ao vivo indisponível, usando status persistido',
                  { connectorId: connector.id, error },
                )
              }
            }

            const data: any = {
              ...connector,
              instance: {
                instanceId: connector.instance?.instanceId,
                channelId: connector.instance?.channelId ?? null,
                vinculatedChannel: connector.instance?.vinculatedChannel,
                settings: parseConnectorSettings(connector.instance?.settings),
                // `CONNECTING` (nunca conectou) x `DISCONNECTED` — o booleano
                // `connected` sozinho não distingue os dois na UI.
                status: connector.instance?.status,
                ...(isHubMessage
                  ? {
                      name: connector.instance
                        ? hubMessageConnectorLabel(connector.instance)
                        : '',
                      connected: hubMessageConnected,
                      // Cobrança do canal oficial é nossa (Stripe), não do provider.
                      paidStatus: 'PAID',
                      due: null,
                      phoneNumber: connector.instance?.phoneNumber ?? null,
                    }
                  : {
                      name: remote?.name?.includes(' | ')
                        ? remote.name.split(' | ')[1]
                        : (remote?.name ?? ''),
                      connected: remote?.connected ?? false,
                      paidStatus: remote?.paymentStatus,
                      due: remote?.due,
                      phoneNumber: phoneData?.phone ? phoneData.phone : null,
                    }),
              },
            }

            if (connector.instance?.vinculatedChannel) {
              try {
                const openChannel = await bx.getOpenChannel(
                  connector.instance.vinculatedChannel,
                )
                if (openChannel?.LINE_NAME) {
                  data.instance.vinculatedChannelName = openChannel.LINE_NAME
                }
              } catch (error) {
                console.error(
                  '[ThinkzapSessionHandler] getOpenChannel failed',
                  {
                    channelId: connector.instance.vinculatedChannel,
                    error,
                  },
                )
              }
            }
            return data
          }),
        )

        return { key: 'connectors', data: mappedConnectors } as T
      },
    },
    {
      perform: async <T>(params: {
        appId: string
        thinkzapAccess?: { canAccessFinance: boolean }
      }): Promise<T> => {
        if (params.thinkzapAccess && !params.thinkzapAccess.canAccessFinance) {
          return { key: 'subscription', data: null } as T
        }
        const subscriptionRepository = new PrismaBillingSubscriptionRepository()
        const subscription = await subscriptionRepository.getByAppId(
          params.appId,
        )
        console.log('subscription', subscription)
        return {
          key: 'subscription',
          data: subscription
            ? {
                status: subscription.status,
                connectorQuantity: subscription.connectorQuantity,
                trialEndsAt: subscription.trialEndsAt,
              }
            : null,
        } as T
      },
    },
  ]
}
