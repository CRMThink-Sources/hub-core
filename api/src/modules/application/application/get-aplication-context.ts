import { Aplication } from '@/modules/application/domain/entities/aplication'
import { Customer } from '@/modules/application/domain/entities/customer'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { AplicationNotFoundError } from '@/modules/application/domain/errors/aplication-not-found.error'
import { AplicationRepository } from '@/modules/application/domain/repositories/aplication.repository'
import { CustomerRepository } from '@/modules/application/domain/repositories/customer.repository'
import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'

/** Assinatura com os itens que ela provisiona. */
export type SubscriptionWithItems = Subscription & {
  items: SubscriptionItem[]
}

/**
 * Contexto de billing de **uma** instalação: quem é o cliente, qual instalação,
 * o que ela paga e o que essa cobrança provisiona.
 */
export interface AplicationContext {
  customer: Customer
  aplication: Aplication
  subscriptions: SubscriptionWithItems[]
}

export interface GetAplicationContextInput {
  /** Uuid de `core_domains`, como vem no JWT. */
  domainId: string
  /** `core_app_codes.id` (`crmthink.thinkzap`), como vem no JWT. */
  appCode: string
}

/**
 * Monta o contexto de billing da instalação atual.
 *
 * Recebe só contratos de domínio e não conhece `Request`/`Response`: outro app
 * que precise do contexto num fluxo não-HTTP (job, script, webhook) importa esta
 * classe, não a rota.
 *
 * A orquestração vive aqui, não num repositório: repositório que chama outro
 * repositório de domínio acopla os contratos entre si.
 */
export class GetAplicationContext {
  /**
   * @param subscriptions Deve vir decorado com `CachedSubscriptionRepository` —
   * a listagem por aplicação hidrata plano, produto e aplicação por assinatura.
   * @param items Deve vir decorado com `CachedSubscriptionItemRepository`: são N
   * listagens de CRM, uma por assinatura.
   */
  constructor(
    private readonly customers: CustomerRepository,
    private readonly aplications: AplicationRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly items: SubscriptionItemRepository,
  ) {}

  async execute({
    domainId,
    appCode,
  }: GetAplicationContextInput): Promise<AplicationContext> {
    /**
     * Passa pelo cliente porque o JWT dá o uuid de `core_domains` e
     * `getAplicationByInstall` pede o **host** do portal. `getCustomer` lança
     * `CustomerNotFoundError` por conta própria.
     *
     * Não usa `getAplicationsByCustomer` + filtro em memória: seria uma query só,
     * mas puxaria todas as instalações do portal e faria o `AplicationTitleReader`
     * chamar o Bitrix com todos os `spaId`s para descartar quase todos.
     */
    const customer = await this.customers.getCustomer(domainId)

    const aplication = await this.aplications.getAplicationByInstall({
      domain: customer.name,
      appCode,
    })

    /**
     * `null` aqui é token válido de app desinstalado: recurso ausente, não token
     * inválido — quem traduz para HTTP responde 404, nunca 401.
     */
    if (!aplication) throw new AplicationNotFoundError(appCode)

    /**
     * Instalação sem espelho na SPA 1060 é estado válido (criada antes do
     * backfill, ou falha na criação do item). O filtro da SPA de assinaturas
     * depende do `spaId`, então não há o que consultar — e o consumidor distingue
     * este caso de "espelhada e sem contrato" pelo próprio `aplication.spaId`.
     */
    if (!aplication.spaId) {
      return { customer, aplication, subscriptions: [] }
    }

    /**
     * Erro de leitura do Bitrix **não** é capturado aqui: tem que subir para o
     * controller virar 502. Devolver `subscriptions: []` porque o CRM interno
     * está fora faria a tela oferecer contratação a cliente pagante.
     */
    const subscriptions = await this.subscriptions.getSubscriptionsByAplication(
      aplication.spaId,
    )

    /**
     * Uma listagem de itens por assinatura, em paralelo. N é o número de
     * assinaturas de **uma** instalação — hoje ~1. Se N crescer, a otimização é
     * o filtro em lote `@parentId1142` numa chamada só.
     */
    const itemsBySubscription = await Promise.all(
      subscriptions.map(subscription =>
        this.items.getSubscriptionItemsBySubscription(subscription.id),
      ),
    )

    return {
      customer,
      aplication,
      subscriptions: subscriptions.map((subscription, index) => ({
        ...subscription,
        items: itemsBySubscription[index] ?? [],
      })),
    }
  }
}
