import {
  GetAplicationContext,
  SubscriptionWithItems,
} from '@/modules/application/application/get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import {
  LineEntitlement,
  resolveLineEntitlement,
} from '@/modules/thinkzap/domain/connector-trial'
import {
  ConnectorSettings,
  DEFAULT_CONNECTOR_SETTINGS,
} from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

/**
 * A linha resolvida por id de provider, com a habilitação derivada da assinatura
 * pai — que vem na mesma travessia, sem leitura extra.
 *
 * Os `settings` dizem **como** a linha se comporta; o `entitlement` diz **se** ela
 * se comporta. Resolver os dois juntos é o que permite bloquear no caminho quente
 * de mensagem sem uma segunda ida ao contexto.
 */
export type ResolvedLineByProvider = {
  item: SubscriptionItem
  settings: ConnectorSettings
  entitlement: LineEntitlement
}

export type ResolveSettingsInput = {
  /** `metadata.zApiInstanceId` do item — o id da instância na Z-API. */
  instanceId: string
  /** Uuid de `core_domains`. */
  domainId: string
  /** `core_app_codes.id`. */
  appCode: string
}

/**
 * Item da linha a partir do `instanceId`.
 *
 * Os consumidores de runtime — callback de status, contexto de webhook, handler de
 * sessão, roteamento de entrada, portal admin — são keyed por instância, não pelo
 * item de assinatura, mas todos alcançam o par (`domainId`, `appCode`):
 *
 * ```
 * (domainId, appCode) ──GetAplicationContext──> itens da instalação
 *                            └──> item com metadata.zApiInstanceId === instanceId
 * ```
 *
 * A varredura é sobre os itens de **uma** instalação, e o contexto vem dos
 * repositórios já decorados com cache — não há varredura global nem cache novo.
 *
 * É a resolução base: `resolveSettingsByInstanceId` é consumidor dela, não o
 * contrário. O roteamento de mensagem recebida precisa do item inteiro
 * (`vinculatedChannel`, id do item) e da habilitação, não só dos toggles.
 *
 * `null` = nenhum item corresponde. Falha de leitura do contexto **propaga**.
 */
export async function findLineItemByInstanceId(
  input: ResolveSettingsInput,
  getAplicationContext: GetAplicationContext,
  now: Date = new Date(),
): Promise<ResolvedLineByProvider | null> {
  const context = await getAplicationContext.execute({
    domainId: input.domainId,
    appCode: input.appCode,
  })

  const matches = matchLines(context.subscriptions, item =>
    hasZApiInstanceId(item, input.instanceId),
  )

  if (matches.length === 0) return null

  /**
   * Credencial repetida entre itens é estado inválido — o mapper já rejeita
   * credencial ambígua **dentro** de um item, mas nada garante unicidade entre
   * itens. Escolher o primeiro mantém a operação de pé; o warning é o que faz o
   * problema aparecer em vez de virar comportamento aleatório.
   */
  if (matches.length > 1) {
    logThinkzapError(
      apiLogger,
      'thinkzap.provisioning.settings_not_found',
      {
        app: 'thinkzap',
        instanceId: input.instanceId,
        itemIds: matches.map(match => match.item.id),
      },
      {
        level: 'warn',
        msg: 'Mais de um item de assinatura com o mesmo zApiInstanceId — usando o primeiro',
      },
    )
  }

  return toResolvedLine(matches[0]!, now)
}

/**
 * Percorre as assinaturas guardando **o pai de cada item**.
 *
 * A travessia antiga era `flatMap(s => s.items)`, que descartava a assinatura no
 * caminho — e o entitlement precisa dela. Guardar o par não custa nada: é a mesma
 * varredura, sobre os itens de uma instalação só.
 */
function matchLines(
  subscriptions: SubscriptionWithItems[],
  predicate: (item: SubscriptionItem) => boolean,
): Array<{ item: SubscriptionItem; subscription: SubscriptionWithItems }> {
  return subscriptions.flatMap(subscription =>
    subscription.items.filter(predicate).map(item => ({ item, subscription })),
  )
}

function toResolvedLine(
  match: { item: SubscriptionItem; subscription: SubscriptionWithItems },
  now: Date,
): ResolvedLineByProvider {
  return {
    item: match.item,
    settings: match.item.settings,
    entitlement: resolveLineEntitlement(match.subscription, now),
  }
}

/**
 * `ConnectorSettings` da linha, pelo `instanceId`.
 *
 * **Ausência resolve default, falha propaga.** As duas coisas são diferentes: item
 * não encontrado é estado (linha removida da SPA, instância órfã) e não pode
 * derrubar o processamento de uma mensagem; erro de leitura é infraestrutura e tem
 * que subir, porque tratá-lo como "não encontrado" desligaria silenciosamente os
 * toggles de todo mundo enquanto o Bitrix estivesse fora.
 */
export async function resolveSettingsByInstanceId(
  input: ResolveSettingsInput,
  getAplicationContext: GetAplicationContext,
): Promise<ConnectorSettings> {
  const line = await findLineItemByInstanceId(input, getAplicationContext)

  return line ? line.settings : { ...DEFAULT_CONNECTOR_SETTINGS }
}

const hasZApiInstanceId = (
  item: SubscriptionItem,
  instanceId: string,
): boolean =>
  item.metadata.provider === 'ZAPI' &&
  item.metadata.zApiInstanceId === instanceId

/**
 * Item da linha HubMessage a partir do `channelId` do webhook.
 *
 * Par do `findLineItemByInstanceId` para o outro provider: o webhook da HubMessage
 * entrega o canal, não um `instanceId`.
 */
export async function findLineItemByChannelId(
  input: { channelId: string; domainId: string; appCode: string },
  getAplicationContext: GetAplicationContext,
  now: Date = new Date(),
): Promise<ResolvedLineByProvider | null> {
  const context = await getAplicationContext.execute({
    domainId: input.domainId,
    appCode: input.appCode,
  })

  const matches = matchLines(
    context.subscriptions,
    item =>
      item.metadata.provider === 'HUBMESSAGE' &&
      item.metadata.hubmessageChannelId === input.channelId,
  )

  if (matches.length === 0) return null

  if (matches.length > 1) {
    logThinkzapError(
      apiLogger,
      'thinkzap.provisioning.settings_not_found',
      {
        app: 'thinkzap',
        channelId: input.channelId,
        itemIds: matches.map(match => match.item.id),
      },
      {
        level: 'warn',
        msg: 'Mais de um item de assinatura com o mesmo canal HubMessage — usando o primeiro',
      },
    )
  }

  return toResolvedLine(matches[0]!, now)
}
