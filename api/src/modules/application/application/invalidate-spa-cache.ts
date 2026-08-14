import type IORedis from 'ioredis'
import { env } from '@/config/env'
import { apiLogger } from '@/shared/infra/logger'
import { APLICATION_PARENT_FIELD } from '@/modules/application/infra/bitrix/mappers/subscription.mapper'
import { SUBSCRIPTION_PARENT_FIELD } from '@/modules/application/infra/bitrix/mappers/subscription-item.mapper'
import {
  PLAN_SCAN_PATTERNS,
  PRODUCT_SCAN_PATTERNS,
  SUBSCRIPTION_ITEM_SCAN_PATTERNS,
  SUBSCRIPTION_ITEMS_BY_SUBSCRIPTION_SCAN_PATTERN,
  SUBSCRIPTION_SCAN_PATTERNS,
  SUBSCRIPTIONS_BY_APLICATION_SCAN_PATTERN,
  planKey,
  planListKey,
  productKey,
  productListKey,
  subscriptionItemKey,
  subscriptionItemListKey,
  subscriptionItemsBySubscriptionKey,
  subscriptionKey,
  subscriptionListKey,
  subscriptionsByAplicationKey,
} from '@/modules/application/infra/cache/keys'
import { scanDelete } from '@/modules/application/infra/cache/scan-delete'

/**
 * Lê o pai de um item de SPA. Existe como porta, e não como chamada direta ao
 * `BitrixClient`, porque o caso de uso só precisa de um id — e o teste não precisa
 * de um cliente HTTP inteiro para exercitar cinco ramos de invalidação.
 */
export type SpaParentReader = {
  /** `null` quando o item não existe mais ou não tem o campo parent preenchido. */
  getParentId(input: {
    entityTypeId: number
    itemId: string
    parentField: string
  }): Promise<string | null>
}

/**
 * O verbo do evento de SPA.
 *
 * Vive aqui, e não no controller, porque quem decide **como** invalidar precisa dele:
 * o controller importaria de `application` de qualquer forma, e a direção contrária —
 * o caso de uso importando de `presentation` — seria a errada.
 *
 * `UNKNOWN` é o payload em que não há nome de evento reconhecível. Ele nunca é tratado
 * como `DELETE`: o efeito do delete aqui é varrer mais chaves sem ler o pai, e assumi-lo
 * por inferência num update faria toda edição varrer o keyspace compartilhado com o
 * BullMQ.
 */
export type EventVerb = 'ADD' | 'UPDATE' | 'DELETE' | 'UNKNOWN'

export type InvalidateSpaCacheInput = {
  entityTypeId: number
  /** Ausente em payload incompleto; alguns ramos não conseguem agir sem ele. */
  itemId?: string
  /**
   * O verbo do evento. Ausente é tratado como não-delete: o caminho de leitura do
   * pai é o comportamento de antes deste parâmetro existir, e errar para esse lado
   * custa uma ida à rede — errar para o outro pularia uma leitura necessária.
   */
  verb?: EventVerb
}

export type InvalidateSpaCacheResult = {
  /** `false` quando a SPA não é de billing — nada foi apagado, e isso não é erro. */
  handled: boolean
  /** Quantas chaves foram removidas, somando `DEL` direto e varredura. */
  deletedKeys: number
}

const IGNORED: InvalidateSpaCacheResult = { handled: false, deletedKeys: 0 }

/**
 * Traduz um evento das SPAs de billing em invalidação de cache Redis.
 *
 * **Invalida, não reescreve.** O webhook de saída do Bitrix entrega só o id do
 * item; reconstruir a entrada exigiria repetir aqui a hidratação de plano, produto
 * e aplicação que vive nos repositórios. `DEL` também é idempotente, o que torna
 * reentrega do Bitrix e corrida com a invalidação da própria escrita inofensivas.
 *
 * **Cascata por entidade aninhada.** As entradas de cache guardam cópias: `Plan`
 * carrega `Product`, e `Subscription` carrega `Plan` (com o produto dentro) e a
 * `Aplication` hidratada. Apagar só a chave do produto editado deixaria a cópia
 * velha viva dentro de cada assinatura até o TTL — que é exatamente o bug que este
 * caso de uso existe para corrigir.
 *
 * **Nada aqui lança.** Falha de Redis ou de Bitrix vira `warn` e resultado parcial:
 * o chamador é um webhook, e o Bitrix desativa handler que erra em sequência.
 */
export class InvalidateSpaCache {
  constructor(
    private readonly redis: IORedis,
    private readonly parents: SpaParentReader,
  ) {}

  async execute(
    input: InvalidateSpaCacheInput,
  ): Promise<InvalidateSpaCacheResult> {
    const { spa } = env.payments

    const deleted = input.verb === 'DELETE'

    try {
      switch (input.entityTypeId) {
        case spa.subscriptionEntityType:
          return await this.invalidateSubscription(input.itemId, deleted)
        case spa.subscriptionItemEntityType:
          return await this.invalidateSubscriptionItem(input.itemId, deleted)
        case spa.planEntityType:
          return await this.invalidatePlan(input.itemId)
        case spa.productEntityType:
          return await this.invalidateProduct(input.itemId)
        case spa.aplicationEntityType:
          return await this.invalidateAplication(deleted)
        default:
          apiLogger.debug(
            { app: 'payments', entityTypeId: input.entityTypeId },
            'SPA fora do escopo de billing — nada a invalidar',
          )
          return IGNORED
      }
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', ...input, error },
        'Invalidação de cache da SPA falhou — ignorando',
      )
      return { handled: true, deletedKeys: 0 }
    }
  }

  /**
   * Assinatura: chave individual, listagem geral e a listagem da aplicação dona.
   *
   * O pai é lido do Bitrix em vez de varrido porque esta é a SPA mais quente —
   * toda escrita da própria API gera um evento aqui, e varrer o keyspace
   * compartilhado com o BullMQ a cada uma sairia bem mais caro que uma leitura.
   *
   * **No delete a leitura é pulada.** O item não existe mais, então ela é 404 por
   * construção: gastaria uma ida à rede por exclusão e produziria um `warn` de
   * "leitura do pai falhou" que não descreve falha nenhuma — ensinando quem lê o log
   * a ignorar a linha que existe para denunciar Bitrix fora do ar.
   */
  private async invalidateSubscription(
    itemId: string | undefined,
    isDelete: boolean,
  ): Promise<InvalidateSpaCacheResult> {
    if (!itemId)
      return this.missingItemId(env.payments.spa.subscriptionEntityType)

    const parentId = isDelete
      ? null
      : await this.readParent(
          env.payments.spa.subscriptionEntityType,
          itemId,
          APLICATION_PARENT_FIELD,
        )

    const deleted = await this.del(
      subscriptionKey(itemId),
      subscriptionListKey(),
      ...(parentId ? [subscriptionsByAplicationKey(parentId)] : []),
    )

    /**
     * Sem pai (item apagado no CRM, ou leitura falhando) não dá para saber qual
     * listagem por aplicação continha a assinatura — e deixá-la intacta manteria a
     * assinatura aparecendo numa lista de onde ela já saiu. Varrer só o padrão das
     * listagens por pai apaga bem menos que a família inteira: as entradas por id
     * sobrevivem.
     */
    const swept = parentId
      ? 0
      : await scanDelete(this.redis, [SUBSCRIPTIONS_BY_APLICATION_SCAN_PATTERN])

    return this.done('subscription', deleted + swept)
  }

  /**
   * Item: chave individual, listagem geral e a listagem da assinatura dona.
   *
   * Não toca na família de assinatura de propósito — `SubscriptionItem` não é
   * aninhado dentro de `Subscription` no cache; o vínculo é o id do pai.
   *
   * No delete a leitura do pai é pulada, pela mesma razão de `invalidateSubscription`.
   */
  private async invalidateSubscriptionItem(
    itemId: string | undefined,
    isDelete: boolean,
  ): Promise<InvalidateSpaCacheResult> {
    if (!itemId) {
      return this.missingItemId(env.payments.spa.subscriptionItemEntityType)
    }

    const parentId = isDelete
      ? null
      : await this.readParent(
          env.payments.spa.subscriptionItemEntityType,
          itemId,
          SUBSCRIPTION_PARENT_FIELD,
        )

    const deleted = await this.del(
      subscriptionItemKey(itemId),
      subscriptionItemListKey(),
      ...(parentId ? [subscriptionItemsBySubscriptionKey(parentId)] : []),
    )

    const swept = parentId
      ? 0
      : await scanDelete(this.redis, [
          SUBSCRIPTION_ITEMS_BY_SUBSCRIPTION_SCAN_PATTERN,
        ])

    return this.done('subscription-item', deleted + swept)
  }

  /**
   * Plano: as chaves do plano mais **toda** a família de assinatura, porque
   * `Subscription.plan` é uma cópia. A família de produto não é tocada — o produto
   * não muda quando o plano muda.
   *
   * A varredura é aceitável aqui: `PlanRepository` é só de leitura, a API nunca
   * escreve na SPA de planos, e o evento só existe quando alguém edita o catálogo
   * à mão.
   */
  private async invalidatePlan(
    itemId?: string,
  ): Promise<InvalidateSpaCacheResult> {
    const deleted = await this.del(
      ...(itemId ? [planKey(itemId)] : []),
      planListKey(),
    )

    const swept = await scanDelete(this.redis, SUBSCRIPTION_SCAN_PATTERNS)

    return this.done('plan', deleted + swept)
  }

  /**
   * Produto: as chaves do produto mais as famílias de plano e de assinatura —
   * a cópia do produto vive em `Plan.product` e, mais fundo, em
   * `Subscription.plan.product`.
   */
  private async invalidateProduct(
    itemId?: string,
  ): Promise<InvalidateSpaCacheResult> {
    const deleted = await this.del(
      ...(itemId ? [productKey(itemId)] : []),
      productListKey(),
    )

    const swept = await scanDelete(this.redis, [
      ...PLAN_SCAN_PATTERNS,
      ...SUBSCRIPTION_SCAN_PATTERNS,
    ])

    return this.done('product', deleted + swept)
  }

  /**
   * Aplicação: a família de assinatura. A SPA 1060 não tem cache próprio em
   * Redis (a aplicação vive no Prisma), mas a entrada de assinatura guarda a
   * aplicação **hidratada** — título, cliente, `active`.
   *
   * **No delete, também a família de item.** A razão não é aninhamento —
   * `SubscriptionItem` não guarda cópia da aplicação: é que as duas famílias
   * alimentam `GET /api/application/me`, e servir por até 5 minutos as linhas de uma
   * instalação cujo espelho deixou de existir é servir contexto de uma aplicação que
   * não existe. No update a família de item fica intacta: editar o espelho não muda
   * item nenhum.
   */
  private async invalidateAplication(
    isDelete: boolean,
  ): Promise<InvalidateSpaCacheResult> {
    const swept = await scanDelete(this.redis, [
      ...SUBSCRIPTION_SCAN_PATTERNS,
      ...(isDelete ? SUBSCRIPTION_ITEM_SCAN_PATTERNS : []),
    ])

    return this.done('aplication', swept)
  }

  /**
   * Leitura do pai que nunca lança: o caminho de fallback (varredura) já cobre o
   * caso de não saber o pai, e é o mesmo caminho de um item apagado no CRM — onde
   * a leitura falha por motivo legítimo.
   */
  private async readParent(
    entityTypeId: number,
    itemId: string,
    parentField: string,
  ): Promise<string | null> {
    try {
      return await this.parents.getParentId({
        entityTypeId,
        itemId,
        parentField,
      })
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', entityTypeId, itemId, parentField, error },
        'Leitura do pai no Bitrix falhou — caindo para varredura',
      )
      return null
    }
  }

  /** `DEL` devolve quantas chaves existiam; chave ausente não é erro. */
  private async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0

    return this.redis.del(...keys)
  }

  private missingItemId(entityTypeId: number): InvalidateSpaCacheResult {
    apiLogger.warn(
      { app: 'payments', entityTypeId },
      'Evento de SPA sem id de item — nada a invalidar',
    )

    return { handled: true, deletedKeys: 0 }
  }

  private done(family: string, deletedKeys: number): InvalidateSpaCacheResult {
    apiLogger.info(
      { app: 'payments', family, deletedKeys },
      'Cache da SPA invalidado',
    )

    return { handled: true, deletedKeys }
  }
}
