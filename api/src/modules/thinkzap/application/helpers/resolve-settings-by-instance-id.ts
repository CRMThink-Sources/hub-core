import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import {
  ConnectorSettings,
  DEFAULT_CONNECTOR_SETTINGS,
} from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { apiLogger } from '@/shared/infra/logger'

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
 * (`vinculatedChannel`, id do item), não só dos toggles.
 *
 * `null` = nenhum item corresponde. Falha de leitura do contexto **propaga**.
 */
export async function findLineItemByInstanceId(
  input: ResolveSettingsInput,
  getAplicationContext: GetAplicationContext,
): Promise<SubscriptionItem | null> {
  const context = await getAplicationContext.execute({
    domainId: input.domainId,
    appCode: input.appCode,
  })

  const matches = context.subscriptions
    .flatMap(subscription => subscription.items)
    .filter(item => hasZApiInstanceId(item, input.instanceId))

  if (matches.length === 0) return null

  /**
   * Credencial repetida entre itens é estado inválido — o mapper já rejeita
   * credencial ambígua **dentro** de um item, mas nada garante unicidade entre
   * itens. Escolher o primeiro mantém a operação de pé; o warning é o que faz o
   * problema aparecer em vez de virar comportamento aleatório.
   */
  if (matches.length > 1) {
    apiLogger.warn(
      {
        app: 'thinkzap',
        instanceId: input.instanceId,
        itemIds: matches.map(item => item.id),
      },
      'Mais de um item de assinatura com o mesmo zApiInstanceId — usando o primeiro',
    )
  }

  return matches[0]!
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
  const item = await findLineItemByInstanceId(input, getAplicationContext)

  return item ? item.settings : { ...DEFAULT_CONNECTOR_SETTINGS }
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
): Promise<SubscriptionItem | null> {
  const context = await getAplicationContext.execute({
    domainId: input.domainId,
    appCode: input.appCode,
  })

  const matches = context.subscriptions
    .flatMap(subscription => subscription.items)
    .filter(
      item =>
        item.metadata.provider === 'HUBMESSAGE' &&
        item.metadata.hubmessageChannelId === input.channelId,
    )

  if (matches.length === 0) return null

  if (matches.length > 1) {
    apiLogger.warn(
      {
        app: 'thinkzap',
        channelId: input.channelId,
        itemIds: matches.map(item => item.id),
      },
      'Mais de um item de assinatura com o mesmo canal HubMessage — usando o primeiro',
    )
  }

  return matches[0]!
}
