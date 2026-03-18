/* eslint-disable @typescript-eslint/no-unsafe-return */
import { env } from '@/config/env'
import { Connector } from '../domain/entities/connector'
import { Instance } from '../domain/entities/instance'
import { ZApiClient } from '../infra/clients/z-api.client'

export const MapConnectorToInstance = async (
  connector: Connector,
): Promise<any> => {
  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)
  const instance = await zApiClient.getInstance(
    connector.instance?.instanceId ?? '',
    connector.instance?.zApiToken ?? '',
  )
  const phoneData = await zApiClient.getPhoneData(
    connector.instance?.instanceId ?? '',
    connector.instance?.zApiToken ?? '',
  )

  return {
    id: connector.id,
    instanceId: connector.instanceId,
    appId: connector.appId,
    phoneData,
    instance,
    createdAt: connector.createdAt,
    updatedAt: connector.updatedAt,
  }
}

export const CollectConnectorToInstance = (connectors: Connector[]): any[] => {
  return connectors.map(
    async connector => await MapConnectorToInstance(connector),
  )
}
