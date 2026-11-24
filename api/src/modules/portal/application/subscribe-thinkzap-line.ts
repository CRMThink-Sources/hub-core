import { env } from '@/config/env'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { AppContextDeps } from '@/modules/thinkzap/application/helpers/list-line-items-for-app'
import { SpaItemResourceMirrorRepository } from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import { RedisSpaItemResourceMirrorRepository } from '@/modules/application/infra/cache/redis-spa-item-resource-mirror.repository'
import { redisConnection } from '@/queue/redis-connection'
import { ProviderEffectsDisabledError } from '../domain/errors/portal-domain.errors'
import { ensureLineMirror } from '@/modules/thinkzap/application/helpers/ensure-line-mirror'
import { resolveFromItem } from '@/modules/thinkzap/application/provider-resource-billing'
import { resolveAdminLine } from './helpers/resolve-admin-line'

/**
 * Item de linha sem a credencial que a operação exige.
 *
 * `422`: o item existe e é linha, mas o campo que o provider pede está vazio na SPA —
 * estado de item criado à mão, ou provisionamento que falhou no meio. Não é `404`,
 * porque afirmar que a linha não existe mandaria o suporte procurar a coisa errada.
 */
export class ThinkzapLineCredentialMissingError extends Error {
  constructor(field: string) {
    super(`Item de assinatura sem "${field}" configurado`)
    this.name = 'ThinkzapLineCredentialMissingError'
  }
}

/**
 * O que as ações de linha do backoffice precisam além da linha: a marca de cobrança do
 * recurso e a flag de ambiente.
 */
export type LineBillingEffects = {
  mirrors: Pick<
    SpaItemResourceMirrorRepository,
    'find' | 'save' | 'setBillingState'
  >
  providerEffectsEnabled: boolean
}

/**
 * Resultado das ações manuais de assinar/desassinar. `markRecorded` é `false` quando o
 * provider aceitou, mas a marca não pôde ser gravada (item sem assinatura pai e sem
 * espelho): o chamador não pode mostrar isso como sucesso completo.
 */
export type LineBillingActionResult = { markRecorded: boolean }

/**
 * Depois do sucesso no provider: garante o espelho e grava a marca. Compartilhado por
 * "assinar" e "desassinar", que só diferem no estado gravado.
 */
export async function recordLineBillingMark(
  effects: LineBillingEffects,
  item: SubscriptionItem,
  state: 'subscribed' | 'unsubscribed',
): Promise<LineBillingActionResult> {
  const resource = resolveFromItem(item)
  // Item sem credencial já foi recusado antes de chamar o provider.
  if ('skip' in resource) return { markRecorded: false }

  const outcome = await ensureLineMirror(effects.mirrors, {
    itemId: item.id,
    resource,
    subscriptionId: item.subscription || null,
  })
  if (outcome === 'no-parent') return { markRecorded: false }

  await effects.mirrors.setBillingState(item.id, state)
  return { markRecorded: true }
}

export const defaultLineBillingEffects = (): LineBillingEffects => ({
  mirrors: new RedisSpaItemResourceMirrorRepository(redisConnection),
  providerEffectsEnabled: env.payments.spa.providerEffectsEnabled,
})

/**
 * Ativa a assinatura do **recurso no provider** — instância Z-API ou canal HubMessage.
 *
 * Não é a assinatura de cobrança da SPA 1142: são coisas diferentes com nomes
 * parecidos, e esta rota não escreve na SPA. Keyed pelo item porque é a única chave que
 * toda linha tem; antes era o uuid de `Instance`, e por isso a ação simplesmente não
 * aparecia para linha nascida na SPA.
 *
 * **Força a chamada**, sem olhar a marca antes: é o caminho do suporte para corrigir uma
 * marca que diverge do provider. Depois do sucesso grava a marca de assinado, como todo
 * outro subscribe do produto — sem ela, o próximo UPDATE do item assinaria de novo.
 * Recusa em homologação, onde o portal Bitrix é o de produção.
 */
export async function subscribeThinkzapLine(
  appId: string,
  subscriptionItemId: string,
  deps?: AppContextDeps,
  effects: LineBillingEffects = defaultLineBillingEffects(),
): Promise<LineBillingActionResult> {
  if (!effects.providerEffectsEnabled) throw new ProviderEffectsDisabledError()

  const item = await resolveAdminLine(appId, subscriptionItemId, deps)

  if (item.metadata.provider === 'HUBMESSAGE') {
    await hubMessageClient().subscribeChannel(item.metadata.hubmessageChannelId)
  } else {
    const { instanceId, token } = zApiCredential(item)
    await zApiClient().subscribe(instanceId, token)
  }

  return recordLineBillingMark(effects, item, 'subscribed')
}

/** Credencial Z-API do item, recusando campo vazio antes de qualquer chamada de rede. */
export function zApiCredential(item: SubscriptionItem): {
  instanceId: string
  token: string
} {
  if (item.metadata.provider !== 'ZAPI') {
    throw new Error(
      `zApiCredential chamado para provider "${item.metadata.provider}"`,
    )
  }

  if (!item.metadata.zApiInstanceId) {
    throw new ThinkzapLineCredentialMissingError('zApiInstanceId')
  }

  if (!item.metadata.zApiInstanceToken) {
    throw new ThinkzapLineCredentialMissingError('zApiInstanceToken')
  }

  return {
    instanceId: item.metadata.zApiInstanceId,
    token: item.metadata.zApiInstanceToken,
  }
}

export const zApiClient = (): ZApiClient =>
  new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)

export const hubMessageClient = (): HubMessageClient =>
  new HubMessageClient({
    baseUrl: env.hubMessage.baseUrl,
    token: env.hubMessage.secretKey,
  })
