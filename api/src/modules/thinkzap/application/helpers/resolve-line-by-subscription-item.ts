import {
  AplicationContext,
  GetAplicationContext,
  SubscriptionWithItems,
} from '@/modules/application/application/get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import {
  LineEntitlement,
  resolveLineEntitlement,
} from '@/modules/thinkzap/domain/connector-trial'
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'

/**
 * Resolve uma **linha** a partir do id do item de assinatura.
 *
 * ```
 * itemId ──GetAplicationContext──> item ──> { zApiInstanceId, zApiInstanceToken, settings, vinculatedChannel }
 * ```
 *
 * Nem `Connector` nem `Instance` participam: tudo que descreve a linha vive no
 * item da SPA. Antes daqui saía também a row de `Instance`, lida em **toda**
 * chamada — e três dos quatro consumidores não usavam o resultado. Quem precisa
 * da âncora persistida resolve por conta própria, com o repositório que já injeta.
 *
 * **A autorização sai de graça.** `GetAplicationContext` resolve a instalação
 * pelo par (`domainId`, `appCodeId`) do JWT e só devolve as assinaturas dela, então
 * o id de um item de outro cliente simplesmente não está na árvore — não há como
 * alcançá-lo trocando o id na URL, e nenhuma checagem extra é necessária.
 *
 * O token resolvido **nunca** pode ser emitido em resposta HTTP; ver os mappers
 * de apresentação desta superfície.
 */
export type ResolvedLine = LineCredential

export type ResolveLineInput = {
  subscriptionItemId: string
  /** Uuid de `core_domains`, como vem no JWT. */
  domainId: string
  /** `core_app_codes.id`, como vem no JWT. */
  appCode: string
}

/** Credencial da linha, sem o registro persistido. */
export type LineCredential = {
  zApiInstanceId: string
  zApiInstanceToken: string
  item: SubscriptionItem
}

/**
 * Parte pura: acha a linha num contexto **já lido** e valida o provider.
 *
 * Separado para que quem já tem o contexto em mãos (a gravação de ajustes, que
 * precisa do `aplication.id`) não pague uma segunda leitura do Bitrix.
 */
/**
 * Acha o item na instalação, **sem** validar provider.
 *
 * Para quem opera sobre qualquer linha — a resolução de templates, por exemplo,
 * que só faz sentido no WhatsApp Oficial.
 */
export function findItemInContext(
  context: AplicationContext,
  subscriptionItemId: string,
): SubscriptionItem {
  const item = context.subscriptions
    .flatMap(subscription => subscription.items)
    .find(candidate => candidate.id === subscriptionItemId)

  if (!item) {
    throw new LineNotFoundError(subscriptionItemId)
  }

  return item
}

/**
 * Acha a linha de **qualquer provider** — Z-API ou HubMessage — rejeitando só
 * `NONE`.
 *
 * Para as superfícies que não precisam de credencial Z-API: vincular e desvincular
 * canal aberto valem para os dois providers. `findLineInContext` recusava
 * HubMessage, e o efeito era que uma linha oficial não tinha como ser ligada a um
 * canal — logo, não recebia mensagem, e a âncora que o roteamento usa nunca nascia.
 */
export function findConnectorLineInContext(
  context: AplicationContext,
  subscriptionItemId: string,
): SubscriptionItem {
  const item = findItemInContext(context, subscriptionItemId)

  if (item.metadata.provider === 'NONE') {
    throw new LineProviderNotSupportedError(item.metadata.provider)
  }

  return item
}

/** A linha com a assinatura que a paga e a habilitação derivada das duas. */
export type LineWithEntitlement = {
  item: SubscriptionItem
  /**
   * `null` quando o item foi achado sem assinatura pai legível no contexto —
   * estado que a travessia por assinaturas não produz, mas que o tipo admite para
   * quem alcança o item por outro caminho.
   */
  subscription: SubscriptionWithItems | null
  entitlement: LineEntitlement
}

/**
 * A linha e a habilitação dela, numa passagem só.
 *
 * **A assinatura pai sai de graça.** A travessia já é
 * `subscriptions.flatMap(s => s.items)`, então o pai está em mãos no momento em que
 * o item é achado — resolver o entitlement aqui não custa leitura nenhuma. É o que
 * permite bloquear no caminho quente de mensagem sem uma segunda ida ao contexto.
 *
 * Não lança por bloqueio: devolve o estado. Leitura precisa do item mesmo
 * bloqueado — a tela tem que mostrar o que o cliente tinha e por que parou. Quem
 * escreve usa `assertLineEnabled`.
 */
export function findLineWithEntitlement(
  context: AplicationContext,
  subscriptionItemId: string,
  now: Date,
): LineWithEntitlement {
  const subscription =
    context.subscriptions.find(candidate =>
      candidate.items.some(item => item.id === subscriptionItemId),
    ) ?? null

  const item = subscription?.items.find(
    candidate => candidate.id === subscriptionItemId,
  )

  if (!item) {
    throw new LineNotFoundError(subscriptionItemId)
  }

  return {
    item,
    subscription,
    entitlement: resolveLineEntitlement(subscription, now),
  }
}

/**
 * Igual, mas recusa linha bloqueada — a porta das rotas de escrita.
 *
 * `LineBlockedError` e não `LineNotFoundError`: "não existe" e "existe e está
 * bloqueada" pedem respostas diferentes, e confundir os dois faria trial vencido
 * parecer linha apagada.
 */
export function assertLineEnabled(
  context: AplicationContext,
  subscriptionItemId: string,
  now: Date,
): LineWithEntitlement {
  const resolved = findLineWithEntitlement(context, subscriptionItemId, now)

  if (resolved.entitlement !== 'active') {
    throw new LineBlockedError(subscriptionItemId, resolved.entitlement)
  }

  return resolved
}

export function findLineInContext(
  context: AplicationContext,
  subscriptionItemId: string,
): LineCredential {
  const item = findItemInContext(context, subscriptionItemId)

  if (item.metadata.provider !== 'ZAPI') {
    throw new LineProviderNotSupportedError(item.metadata.provider)
  }

  return {
    zApiInstanceId: item.metadata.zApiInstanceId,
    zApiInstanceToken: item.metadata.zApiInstanceToken,
    item,
  }
}

export async function resolveLineBySubscriptionItem(
  input: ResolveLineInput,
  getAplicationContext: GetAplicationContext,
): Promise<ResolvedLine> {
  /**
   * Erro de leitura do contexto (Bitrix fora, por exemplo) **não** é capturado:
   * tem que subir para o controller virar `502`. Traduzir para "não encontrado"
   * afirmaria que a linha não existe quando só a leitura falhou.
   */
  const context = await getAplicationContext.execute({
    domainId: input.domainId,
    appCode: input.appCode,
  })

  return findLineInContext(context, input.subscriptionItemId)
}
