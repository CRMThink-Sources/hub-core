import { env } from '@/config/env'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { resolveLineEntitlement } from '@/modules/thinkzap/domain/connector-trial'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { PhoneDataResponse } from '@/modules/thinkzap/infra/clients/types/z-api.types'
import { ZApiInstanceGateway } from '@/modules/thinkzap/infra/persistence/gateway/instance.gateway'
import { makeConnectorProviderResolver } from '@/modules/thinkzap/main/make-connector-provider-resolver'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError, thinkzapError } from '../errors/catalog'

export type OpenChannelNameReader = {
  getOpenChannel(channelId: string): Promise<{ LINE_NAME?: string } | null>
}

export type WidgetLineInstance = {
  instanceId: string | null
  channelId: string | null
  vinculatedChannel: string | null
  vinculatedChannelName?: string
  name: string | null
  connected: boolean
  paidStatus: string | null
  // Epoch em ms, como a Z-API devolve.
  due: number | null
  phoneNumber: string | null
  settings: ConnectorSettings
}

export type WidgetLine = {
  id: string
  appId: string
  provider: SubscriptionItem['metadata']['provider']
  status: SubscriptionItem['status']
  // No topo por compatibilidade com `/thinkzap/connector/list`, que filtra por ele.
  phoneData: PhoneDataResponse | null
  instance: WidgetLineInstance
}

// Falha no status do provider degrada para desconectado: uma linha não esconde as outras.
export async function listLinesForWidget(params: {
  appId: string
  domainId: string
  appCode: string
  bitrix: OpenChannelNameReader
  getAplicationContext: GetAplicationContext
}): Promise<WidgetLine[]> {
  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)
  // Resolver único: o adapter HubMessage memoiza `listBusinesses`.
  const providerResolver = makeConnectorProviderResolver({
    zApiClient,
    instanceGateway: new ZApiInstanceGateway(zApiClient),
  })

  const context = await params.getAplicationContext.execute({
    domainId: params.domainId,
    appCode: params.appCode,
  })

  // Linha bloqueada sai: o envio a recusaria. Entitlement vem da assinatura pai.
  const now = new Date()
  const lines = context.subscriptions.flatMap(subscription =>
    resolveLineEntitlement(subscription, now) === 'active'
      ? subscription.items.filter(item => item.metadata.provider !== 'NONE')
      : [],
  )

  return Promise.all(
    lines.map(async item => {
      const resolved =
        item.metadata.provider === 'HUBMESSAGE'
          ? await hubMessageInstance(item, providerResolver)
          : await zApiInstance(item, zApiClient)

      const vinculatedChannelName = await resolveChannelName(
        item.vinculatedChannel,
        params.bitrix,
      )

      return {
        id: item.id,
        appId: params.appId,
        provider: item.metadata.provider,
        status: item.status,
        phoneData: resolved.phoneData,
        instance: {
          ...resolved.instance,
          vinculatedChannel: item.vinculatedChannel,
          settings: item.settings,
          ...(vinculatedChannelName ? { vinculatedChannelName } : {}),
        },
      }
    }),
  )
}

type ProviderResolver = ReturnType<typeof makeConnectorProviderResolver>

type ResolvedLine = {
  instance: Omit<WidgetLineInstance, 'vinculatedChannel' | 'settings'>
  phoneData: PhoneDataResponse | null
}

async function zApiInstance(
  item: SubscriptionItem,
  zApiClient: ZApiClient,
): Promise<ResolvedLine> {
  if (item.metadata.provider !== 'ZAPI') {
    throw thinkzapError('thinkzap.line.provider_unsupported')
  }

  const { zApiInstanceId, zApiInstanceToken } = item.metadata

  const remote = await zApiClient
    .getInstance(zApiInstanceId, zApiInstanceToken)
    .catch((error: unknown) => {
      logThinkzapError(apiLogger, 'thinkzap.zapi.instance_get_failed', {
        app: 'thinkzap',
        subscriptionItemId: item.id,
        err: error,
      })
      return null
    })

  const phoneData = remote?.connected
    ? await zApiClient
        .getPhoneData(zApiInstanceId, zApiInstanceToken)
        .catch(() => null)
    : null

  return {
    phoneData,
    instance: {
      instanceId: zApiInstanceId,
      channelId: null,
      // Nome remoto vem como `portal | linha`.
      name: remote?.name?.includes(' | ')
        ? (remote.name.split(' | ')[1] ?? item.name)
        : (remote?.name ?? item.name),
      connected: remote?.connected ?? false,
      paidStatus: remote?.paymentStatus ?? null,
      due: remote?.due ?? null,
      phoneNumber: phoneData?.phone ?? null,
    },
  }
}

async function hubMessageInstance(
  item: SubscriptionItem,
  providerResolver: ProviderResolver,
): Promise<ResolvedLine> {
  if (item.metadata.provider !== 'HUBMESSAGE') {
    throw thinkzapError('thinkzap.line.provider_unsupported')
  }

  const { hubmessageChannelId, wabaId } = item.metadata

  let connected = false
  try {
    const status = await providerResolver
      .resolve(ConnectorProvider.HUBMESSAGE)
      .getConnectionStatus({
        instanceId: hubmessageChannelId,
        channelId: hubmessageChannelId,
        wabaId,
      })
    if (status.available) connected = status.connected
  } catch (error) {
    logThinkzapError(
      apiLogger,
      'thinkzap.hubmessage.request_failed',
      { app: 'thinkzap', subscriptionItemId: item.id, err: error },
      { msg: 'HubMessage: status ao vivo indisponível ao listar linhas' },
    )
  }

  return {
    phoneData: null,
    instance: {
      instanceId: null,
      channelId: hubmessageChannelId,
      name: item.name,
      connected,
      // Cobrança do canal oficial é nossa (Stripe), não do provider.
      paidStatus: 'PAID',
      due: null,
      phoneNumber: null,
    },
  }
}

async function resolveChannelName(
  channelId: string | null,
  bitrix: OpenChannelNameReader,
): Promise<string | null> {
  if (!channelId) return null

  try {
    const openChannel = await bitrix.getOpenChannel(channelId)
    return openChannel?.LINE_NAME ?? null
  } catch (error) {
    apiLogger.error(
      { app: 'thinkzap', channelId, err: error },
      'Falha ao resolver o nome do canal aberto vinculado',
    )
    return null
  }
}
