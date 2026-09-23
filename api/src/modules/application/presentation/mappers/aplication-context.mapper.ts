import { Aplication } from '@/modules/application/domain/entities/aplication'
import { Customer } from '@/modules/application/domain/entities/customer'
import { Plan } from '@/modules/application/domain/entities/plan'
import { Product } from '@/modules/application/domain/entities/product'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import {
  AplicationContext,
  SubscriptionWithItems,
} from '@/modules/application/application/get-aplication-context'

/**
 * **Fronteira pública da API.** Nada sai daqui por spread de entidade de
 * domínio: campo novo em `Customer`, `Aplication`, `Subscription`, `Plan`,
 * `Product` ou `SubscriptionItem` só aparece no payload se alguém acrescentar
 * explicitamente neste arquivo.
 *
 * É essa regra que impede o `zApiInstanceToken` de vazar — ver `metadataView`.
 */

export type CustomerView = {
  id: string
  name: string
  memberId: string
}

export type AplicationView = {
  id: string
  spaId: string | null
  appCode: string
  title: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type ProductView = {
  id: string
  name: string
  billingModel: string
  active: boolean
}

export type PlanView = {
  id: string
  name: string
  product: ProductView
  /**
   * Valor de cadastro do CRM, em centavos. **Não é o preço cobrado.**
   *
   * O preço do plano é escalonado no gateway, então não existe valor unitário a
   * multiplicar: quem responde "quanto o cliente paga" é `GET /thinkzap/subscription`,
   * que devolve o valor de cada plano do contrato e o total já calculados. Este campo
   * fica como rótulo do catálogo — nenhuma tela deve multiplicá-lo por quantidade.
   *
   * O preço do gateway **não** é projetado aqui de propósito: duas respostas para a
   * mesma pergunta divergem, e o valor calculado tem um dono só.
   */
  amount: number
  interval: Plan['interval']
  gatewayId?: string
  active: boolean
}

/**
 * `metadata` sem credencial: provider sempre, identificadores não secretos
 * conforme o provider, e **nunca** `zApiInstanceToken`.
 *
 * `zApiInstanceId` + token é credencial completa da Z-API — quem tem os dois
 * envia mensagem pela instância do cliente. Esta resposta vai para JavaScript no
 * navegador, dentro do iframe do Bitrix, para qualquer usuário com JWT válido do
 * app (inclusive não-admin). Precedente no repositório: a listagem de conectores
 * do `thinkzap` (`mapConnectorToInstance`) também expõe `instanceId`/`channelId`
 * e omite o token.
 */
export type SubscriptionItemMetadataView =
  | { provider: 'ZAPI'; zApiInstanceId: string }
  | {
      provider: 'HUBMESSAGE'
      hubmessageChannelId: string
      /** Ausente até o número ser conectado na Meta — ver a entidade. */
      wabaId?: string
    }
  | { provider: 'NONE' }

export type SubscriptionItemView = {
  id: string
  name: string
  status: SubscriptionItem['status']
  gatewayId?: string
  metadata: SubscriptionItemMetadataView
  /**
   * Último estado de conexão registrado no item (`UF_CRM_93_CONNECTED`), gravado
   * pelos eventos de conexão/desconexão dos providers. `null` = nunca registrado.
   *
   * Serve para **exibir** na lista de conexões sem uma consulta ao provider por
   * linha. Não é autoridade: a aba de conexão da linha continua lendo ao vivo.
   */
  connected: boolean | null
}

export type SubscriptionView = {
  id: string
  name: string
  status: SubscriptionWithItems['status']
  currentPeriodStart: string
  currentPeriodEnd: string
  gatewayId?: string
  /** O produto cobrado sai em `plan.product` — a assinatura não tem produto próprio. */
  plan: PlanView
  items: SubscriptionItemView[]
}

export type AplicationContextView = {
  customer: CustomerView
  aplication: AplicationView
  subscriptions: SubscriptionView[]
}

const customerView = (customer: Customer): CustomerView => ({
  id: customer.id,
  name: customer.name,
  memberId: customer.memberId,
})

/** Sem `customer` aninhado: o cliente é a raiz da árvore. */
const aplicationView = (aplication: Aplication): AplicationView => ({
  id: aplication.id,
  spaId: aplication.spaId,
  appCode: aplication.appCode,
  title: aplication.title,
  active: aplication.active,
  createdAt: aplication.createdAt.toISOString(),
  updatedAt: aplication.updatedAt.toISOString(),
})

const productView = (product: Product): ProductView => ({
  id: product.id,
  name: product.name,
  billingModel: product.billingModel,
  active: product.active,
})

const planView = (plan: Plan): PlanView => ({
  id: plan.id,
  name: plan.name,
  product: productView(plan.product),
  amount: plan.amount,
  interval: plan.interval,
  gatewayId: plan.gatewayId,
  active: plan.active,
})

/**
 * Exportada para que **toda** superfície HTTP que serializa item de assinatura passe
 * pela mesma redação — o portal admin também lê itens com token. Duas cópias da regra
 * significariam duas chances de alguém trocar por spread.
 */
export const metadataView = (
  metadata: SubscriptionItem['metadata'],
): SubscriptionItemMetadataView => {
  switch (metadata.provider) {
    case 'ZAPI':
      // `zApiInstanceToken` fica de fora de propósito. Não trocar por spread.
      return { provider: 'ZAPI', zApiInstanceId: metadata.zApiInstanceId }
    case 'HUBMESSAGE':
      return {
        provider: 'HUBMESSAGE',
        hubmessageChannelId: metadata.hubmessageChannelId,
        // Omitida quando ausente: a chave presente com `undefined` some no JSON igual,
        // e o tipo do front fica dizendo a verdade em vez de prometer sempre vir.
        ...(metadata.wabaId ? { wabaId: metadata.wabaId } : {}),
      }
    case 'NONE':
      return { provider: 'NONE' }
  }
}

/** Sem `subscription`: o item já está aninhado dentro da sua assinatura. */
const subscriptionItemView = (
  item: SubscriptionItem,
): SubscriptionItemView => ({
  id: item.id,
  name: item.name,
  status: item.status,
  gatewayId: item.gatewayId,
  metadata: metadataView(item.metadata),
  connected: item.connected ?? null,
})

/** Sem `aplication`: a instalação é o pai. */
const subscriptionView = (
  subscription: SubscriptionWithItems,
): SubscriptionView => ({
  id: subscription.id,
  name: subscription.name,
  status: subscription.status,
  // Explícito em vez de depender do default de JSON.stringify para `Date`.
  currentPeriodStart: subscription.currentPeriodStart.toISOString(),
  currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
  gatewayId: subscription.gatewayId,
  plan: planView(subscription.plan),
  items: subscription.items.map(subscriptionItemView),
})

export const mapAplicationContextToView = (
  context: AplicationContext,
): AplicationContextView => ({
  customer: customerView(context.customer),
  aplication: aplicationView(context.aplication),
  subscriptions: context.subscriptions.map(subscriptionView),
})
