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

/** O mínimo do cliente Bitrix que a resolução de nome de canal precisa. */
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
  /** Vencimento da instância Z-API, epoch em ms como o provider devolve. */
  due: number | null
  phoneNumber: string | null
  /** Os quatro toggles, do item — o widget lê `widgetOpenChannelEnabled`. */
  settings: ConnectorSettings
}

export type WidgetLine = {
  /** Id do item de assinatura: a mesma chave de ajustes, grupos e envio. */
  id: string
  appId: string
  provider: SubscriptionItem['metadata']['provider']
  status: SubscriptionItem['status']
  /**
   * Aparelho da Z-API, quando a linha está conectada. Fica no topo por compatibilidade
   * com `/thinkzap/connector/list`, cujo consumidor filtra por este campo.
   */
  phoneData: PhoneDataResponse | null
  instance: WidgetLineInstance
}

/**
 * As linhas de uma instalação para as superfícies do CRM — widget do contact
 * center e handler de sessão.
 *
 * Origem: o **item de assinatura**. `Connector` deixou de responder "quais linhas
 * existem": linha nascida na SPA não tem row, e a listagem antiga devolvia vazio,
 * então o widget não oferecia linha nenhuma — sem erro e sem log.
 *
 * Estado de conexão vem do provider ao vivo, como já vinha: Z-API por instância,
 * HubMessage agregado por WABA. Falha na consulta degrada para desconectado em vez
 * de derrubar a lista — uma linha ilegível não pode esconder as outras.
 *
 * Compartilhado entre os dois chamadores de propósito: duplicar esta montagem foi
 * o que deixou o widget e a tela discordando sobre o que é uma linha.
 */
export async function listLinesForWidget(params: {
  appId: string
  domainId: string
  appCode: string
  bitrix: OpenChannelNameReader
  getAplicationContext: GetAplicationContext
}): Promise<WidgetLine[]> {
  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)
  /**
   * Resolver único por chamada: o adapter HubMessage memoiza `listBusinesses`, e
   * um resolver por linha jogaria essa consulta fora a cada item.
   */
  const providerResolver = makeConnectorProviderResolver({
    zApiClient,
    instanceGateway: new ZApiInstanceGateway(zApiClient),
  })

  const context = await params.getAplicationContext.execute({
    domainId: params.domainId,
    appCode: params.appCode,
  })

  /**
   * Item de cobrança sem conector (`NONE`) não é linha e não entra na lista.
   *
   * Linha bloqueada também sai: **o widget existe para mandar mensagem**, e oferecer
   * uma linha que o envio vai recusar só gera erro na cara do operador. Ela continua
   * visível na tela de conexões, que é onde o estado é explicado.
   *
   * O entitlement vem da assinatura pai, que já está na travessia — por isso o
   * filtro é feito aqui e não por item, que teria perdido o pai.
   */
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

/** `instance` sem os campos que vêm do item, mais o aparelho, que fica no topo. */
type ResolvedLine = {
  instance: Omit<WidgetLineInstance, 'vinculatedChannel' | 'settings'>
  phoneData: PhoneDataResponse | null
}

async function zApiInstance(
  item: SubscriptionItem,
  zApiClient: ZApiClient,
): Promise<ResolvedLine> {
  if (item.metadata.provider !== 'ZAPI') {
    throw new Error(`Linha Z-API esperada, recebido ${item.metadata.provider}`)
  }

  const { zApiInstanceId, zApiInstanceToken } = item.metadata

  const remote = await zApiClient
    .getInstance(zApiInstanceId, zApiInstanceToken)
    .catch(() => null)

  // Telefone só é consultado com a instância conectada: desconectada não tem.
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
      /**
       * O nome remoto vem prefixado com o host (`portal | linha`). A tela mostra a
       * segunda metade; sem prefixo, o nome inteiro; sem instância legível, o nome
       * do item, que é o que o cliente digitou.
       */
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
    throw new Error(
      `Linha HubMessage esperada, recebido ${item.metadata.provider}`,
    )
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
    apiLogger.warn(
      { app: 'thinkzap', subscriptionItemId: item.id, err: error },
      'HubMessage: status ao vivo indisponível ao listar linhas',
    )
  }

  return {
    // A HubMessage não expõe aparelho: não há equivalente de `device` da Z-API.
    phoneData: null,
    instance: {
      instanceId: null,
      channelId: hubmessageChannelId,
      // A HubMessage não expõe leitura de canal: o nome editável é o do item.
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
