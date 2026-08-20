/* eslint-disable @typescript-eslint/no-unsafe-return */
import { env } from '@/config/env'
import { Connector, ConnectorProvider } from '../domain/entities/connector'
import { InstanceStatus } from '../domain/entities/instance'
import { ConnectorProviderResolver } from '../domain/ports/connector-provider-resolver.port'
import { ZApiClient } from '../infra/clients/z-api.client'
import { ZApiInstanceGateway } from '../infra/persistence/gateway/instance.gateway'
import { makeConnectorProviderResolver } from './make-connector-provider-resolver'

/**
 * Deriva `connected` de um conector HubMessage consultando o provider ao vivo
 * (agregado por WABA). Em falha da consulta — ou provider não registrado —
 * aplica fallback ao status persistido em `Instance.status`.
 */
const resolveHubMessageConnected = async (
  connector: Connector,
  resolver: ConnectorProviderResolver,
): Promise<boolean> => {
  const inst = connector.instance
  const persisted = inst?.status === InstanceStatus.CONNECTED
  try {
    const provider = resolver.resolve(ConnectorProvider.HUBMESSAGE)
    const status = await provider.getConnectionStatus({
      instanceId: connector.instanceId,
      channelId: inst?.channelId ?? inst?.instanceId ?? null,
      wabaId: inst?.wabaId ?? null,
    })
    return status.available ? status.connected : persisted
  } catch {
    // Status ao vivo indisponível: o provider já registrou a falha; aqui só
    // degradamos para o status persistido.
    return persisted
  }
}

/** Serialização de um conector HubMessage com status de conexão ao vivo. */
const mapHubMessageConnector = async (
  connector: Connector,
  resolver: ConnectorProviderResolver,
): Promise<any> => {
  const inst = connector.instance
  const connected = await resolveHubMessageConnected(connector, resolver)
  return {
    id: connector.id,
    instanceId: connector.instanceId,
    appId: connector.appId,
    provider: ConnectorProvider.HUBMESSAGE,
    phoneData: null,
    instance: {
      name: inst?.instanceId ?? null,
      connected,
      // HubMessage não usa o modelo de pagamento por instância da Z-API.
      paidStatus: 'PAID',
      channelId: inst?.channelId ?? inst?.instanceId ?? null,
      vinculatedChannel: inst?.vinculatedChannel ?? null,
      vinculatedChannelName: inst?.vinculatedChannel ?? null,
      phoneNumber: inst?.phoneNumber ?? null,
    },
    createdAt: connector.createdAt,
    updatedAt: connector.updatedAt,
  }
}

/** Monta um resolver de providers a partir da configuração de ambiente. */
const makeResolver = (): ConnectorProviderResolver => {
  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)
  return makeConnectorProviderResolver({
    zApiClient,
    instanceGateway: new ZApiInstanceGateway(zApiClient),
  })
}

export const MapConnectorToInstance = async (
  connector: Connector,
  resolver: ConnectorProviderResolver = makeResolver(),
): Promise<any> => {
  if (
    (connector.provider ?? ConnectorProvider.ZAPI) ===
    ConnectorProvider.HUBMESSAGE
  ) {
    return mapHubMessageConnector(connector, resolver)
  }

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
    provider: ConnectorProvider.ZAPI,
    phoneData,
    instance,
    createdAt: connector.createdAt,
    updatedAt: connector.updatedAt,
  }
}

export const CollectConnectorToInstance = (connectors: Connector[]): any[] => {
  // Resolver único por chamada: compartilha o adapter HubMessage entre os
  // conectores para reaproveitar o memo de `listBusinesses` no mesmo request.
  const resolver = makeResolver()
  return connectors.map(
    async connector => await MapConnectorToInstance(connector, resolver),
  )
}
