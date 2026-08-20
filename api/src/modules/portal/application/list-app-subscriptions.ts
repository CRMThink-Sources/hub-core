import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { SubscriptionWithItems } from '@/modules/application/application/get-aplication-context'
import {
  SubscriptionItemMetadataView,
  metadataView,
} from '@/modules/application/presentation/mappers/aplication-context.mapper'
import {
  AppContextDeps,
  resolveAppContext,
} from '@/modules/thinkzap/application/helpers/list-line-items-for-app'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { AdminAppNotFoundError } from './helpers/resolve-admin-line'

export type AdminSubscriptionItemView = {
  id: string
  name: string
  status: string
  metadata: SubscriptionItemMetadataView
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
  subscriptions: AdminSubscriptionView[]
}

/**
 * As assinaturas de uma instalação, para a aba Assinaturas do portal admin.
 *
 * Somente leitura, direto das SPAs 1142 (assinatura) e 1146 (item) via
 * `GetAplicationContext` — a mesma fonte que o tenant lê em `/application/me`. É o que
 * faz admin e cliente não discordarem sobre o que está contratado.
 *
 * A aba existia sobre `billing_subscriptions` e sumiu quando aquela tabela saiu; nada
 * tomou o lugar, e o suporte passou a abrir uma instalação sem ver o que ela paga.
 *
 * Falha de leitura do Bitrix **não** é capturada: sobe para o controller virar `502`.
 * Devolver lista vazia porque o CRM interno caiu faria a tela afirmar que o cliente não
 * tem contrato.
 */
export async function listAppSubscriptions(
  appId: string,
  deps: AppContextDeps = defaultDeps(),
): Promise<ListAppSubscriptionsOutput> {
  const resolved = await resolveAppContext(appId, deps)

  if (!resolved) throw new AdminAppNotFoundError(appId)

  const { context } = resolved

  /**
   * `spaId` nulo devolve `subscriptions: []` pelo próprio `GetAplicationContext`; o
   * flag é o que separa isso de "espelhada e sem contrato", e vem do mesmo lugar que
   * aquela decisão.
   */
  return {
    mirrored: context.aplication.spaId !== null,
    subscriptions: context.subscriptions.map(subscriptionView),
  }
}

/**
 * Fronteira pública: campos explícitos, nunca spread de entidade — é o que impede
 * `zApiInstanceToken` de aparecer no payload quando alguém acrescentar campo ao item.
 * A redação de `metadata` é a mesma função que `/application/me` usa.
 */
const subscriptionView = (
  subscription: SubscriptionWithItems,
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
  })),
})

const defaultDeps = (): AppContextDeps => ({
  getApp: new PrismaInstalledAppRepository(),
  getAplicationContext: makeGetAplicationContext(),
})
