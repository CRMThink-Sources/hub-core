import { env } from '@/config/env'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { SubscriptionWithItems } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { SpaItemResourceMirrorRepository } from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import { RedisSpaItemResourceMirrorRepository } from '@/modules/application/infra/cache/redis-spa-item-resource-mirror.repository'
import {
  SubscriptionItemMetadataView,
  metadataView,
} from '@/modules/application/presentation/mappers/aplication-context.mapper'
import {
  AppContextDeps,
  resolveAppContext,
} from '@/modules/thinkzap/application/helpers/list-line-items-for-app'
import { redisConnection } from '@/queue/redis-connection'
import { apiLogger } from '@/shared/infra/logger'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { AdminAppNotFoundError } from './helpers/resolve-admin-line'

/**
 * O que a marca do espelho do recurso diz sobre a cobrança da linha no provider.
 *
 * `unknown` = sem marca nenhuma (linha anterior ao backfill do espelho, ou provisionada e
 * nunca assinada por um caminho nosso) ou leitura do Redis que falhou. Não é "não
 * assinada": nada foi confirmado em nenhum sentido.
 */
export type ProviderBillingView = 'subscribed' | 'unsubscribed' | 'unknown'

export type AdminSubscriptionItemView = {
  id: string
  name: string
  status: string
  metadata: SubscriptionItemMetadataView
  /** A credencial que o provider exige está preenchida — sem expor qual é. */
  hasCredential: boolean
  providerBilling: ProviderBillingView
}

export type AdminSubscriptionView = {
  id: string
  name: string
  status: string
  modality: string
  currentPeriodStart: string
  currentPeriodEnd: string
  planName: string
  productName: string
  /** Id no gateway. Ausente em assinatura manual (boleto), que não tem par no Stripe. */
  gatewayId?: string
  items: AdminSubscriptionItemView[]
}

export type ListAppSubscriptionsOutput = {
  /**
   * `false` = instalação sem item espelho na SPA 1060. A tela precisa distinguir isso
   * de "espelhada e sem contrato": no primeiro caso não há o que consultar, porque o
   * filtro da SPA 1142 é pelo campo parent.
   */
  mirrored: boolean
  /**
   * `false` em homologação: as ações de assinatura e de provider são recusadas ali, e a
   * tela as mostra desabilitadas com o motivo em vez de deixar o clique falhar.
   */
  providerEffectsEnabled: boolean
  subscriptions: AdminSubscriptionView[]
}

export type ListAppSubscriptionsEffects = {
  mirrors: Pick<SpaItemResourceMirrorRepository, 'find'>
  providerEffectsEnabled: boolean
}

/**
 * As assinaturas de uma instalação, para a aba Assinaturas do portal admin.
 *
 * Leitura direto das SPAs 1142 (assinatura) e 1146 (item) via `GetAplicationContext` —
 * a mesma fonte que o tenant lê em `/application/me`. É o que faz admin e cliente não
 * discordarem sobre o que está contratado. O estado no provider de cada linha vem da
 * marca do espelho do recurso, a mesma que o ciclo da SPA usa para decidir.
 *
 * A aba existia sobre `billing_subscriptions` e sumiu quando aquela tabela saiu; nada
 * tomou o lugar, e o suporte passou a abrir uma instalação sem ver o que ela paga.
 *
 * Falha de leitura do Bitrix **não** é capturada: sobe para o controller virar `502`.
 * Devolver lista vazia porque o CRM interno caiu faria a tela afirmar que o cliente não
 * tem contrato. Falha do Redis na marca, essa sim, degrada para `unknown`: a marca é
 * detalhe da linha, não o contrato.
 */
export async function listAppSubscriptions(
  appId: string,
  deps: AppContextDeps = defaultDeps(),
  effects: ListAppSubscriptionsEffects = defaultEffects(),
): Promise<ListAppSubscriptionsOutput> {
  const resolved = await resolveAppContext(appId, deps)

  if (!resolved) throw new AdminAppNotFoundError(appId)

  const { context } = resolved

  const itemIds = context.subscriptions.flatMap(subscription =>
    subscription.items.map(item => item.id),
  )
  const billing = new Map(
    await Promise.all(
      itemIds.map(
        async itemId =>
          [itemId, await readProviderBilling(itemId, effects)] as const,
      ),
    ),
  )

  /**
   * `spaId` nulo devolve `subscriptions: []` pelo próprio `GetAplicationContext`; o
   * flag é o que separa isso de "espelhada e sem contrato", e vem do mesmo lugar que
   * aquela decisão.
   */
  return {
    mirrored: context.aplication.spaId !== null,
    providerEffectsEnabled: effects.providerEffectsEnabled,
    subscriptions: context.subscriptions.map(subscription =>
      subscriptionView(subscription, billing),
    ),
  }
}

async function readProviderBilling(
  itemId: string,
  effects: ListAppSubscriptionsEffects,
): Promise<ProviderBillingView> {
  try {
    const mirror = await effects.mirrors.find(itemId)
    if (mirror?.subscribedAt) return 'subscribed'
    if (mirror?.unsubscribedAt) return 'unsubscribed'
    return 'unknown'
  } catch (error) {
    apiLogger.warn(
      { app: 'payments', itemId, err: error },
      'Leitura da marca de cobrança do recurso falhou — mostrando como desconhecida',
    )
    return 'unknown'
  }
}

const hasCredential = (metadata: SubscriptionItem['metadata']): boolean => {
  switch (metadata.provider) {
    case 'ZAPI':
      return Boolean(metadata.zApiInstanceId && metadata.zApiInstanceToken)
    case 'HUBMESSAGE':
      return Boolean(metadata.hubmessageChannelId)
    case 'NONE':
      return false
  }
}

/**
 * Fronteira pública: campos explícitos, nunca spread de entidade — é o que impede
 * `zApiInstanceToken` de aparecer no payload quando alguém acrescentar campo ao item.
 * A redação de `metadata` é a mesma função que `/application/me` usa.
 */
const subscriptionView = (
  subscription: SubscriptionWithItems,
  billing: Map<string, ProviderBillingView>,
): AdminSubscriptionView => ({
  id: subscription.id,
  name: subscription.name,
  status: subscription.status,
  modality: subscription.modality,
  currentPeriodStart: subscription.currentPeriodStart.toISOString(),
  currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
  planName: subscription.plan.name,
  /** A assinatura não tem produto próprio: o cobrado é o do plano. */
  productName: subscription.plan.product.name,
  ...(subscription.gatewayId ? { gatewayId: subscription.gatewayId } : {}),
  items: subscription.items.map(item => ({
    id: item.id,
    name: item.name,
    status: item.status,
    metadata: metadataView(item.metadata),
    hasCredential: hasCredential(item.metadata),
    providerBilling: billing.get(item.id) ?? 'unknown',
  })),
})

const defaultDeps = (): AppContextDeps => ({
  getApp: new PrismaInstalledAppRepository(),
  getAplicationContext: makeGetAplicationContext(),
})

const defaultEffects = (): ListAppSubscriptionsEffects => ({
  mirrors: new RedisSpaItemResourceMirrorRepository(redisConnection),
  providerEffectsEnabled: env.payments.spa.providerEffectsEnabled,
})
