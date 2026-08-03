import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import {
  CreateSubscriptionInput,
  SubscriptionRepository,
  UpdateSubscriptionInput,
} from '@/modules/application/domain/repositories/subscription.repository'
import { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'
import { AplicationRepository } from '@/modules/application/domain/repositories/aplication.repository'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import { Plan } from '@/modules/application/domain/entities/plan'
import { Aplication } from '@/modules/application/domain/entities/aplication'
import { SubscriptionNotFoundError } from '@/modules/application/domain/errors/subscription-not-found.error'
import { PlanNotFoundError } from '@/modules/application/domain/errors/plan-not-found.error'
import { AplicationNotFoundError } from '@/modules/application/domain/errors/aplication-not-found.error'
import { env } from '@/config/env'
import {
  APLICATION_PARENT_FIELD,
  RawSubscription,
  collectBitrixSpaSubscriptionToRawSubscription,
  mapBitrixSpaSubscriptionToRawSubscription,
  mapSubscriptionInputToBitrixFields,
} from '../mappers/subscription.mapper'

export class BitrixSubscriptionRepository implements SubscriptionRepository {
  /**
   * @param plans Deve vir decorado com `CachedPlanRepository`. A SPA de
   * assinaturas só devolve o id do plano, então cada leitura hidrata o `Plan`
   * — sem cache, isso vira uma chamada extra ao Bitrix por assinatura. O produto
   * cobrado vem dentro dele (`plan.product`); a assinatura não tem produto
   * próprio, porque a SPA 1142 não tem campo de produto.
   * @param aplications Resolve a instalação a partir do campo parent. Consulta o
   * banco, não o Bitrix.
   */
  constructor(
    private readonly bitrix: BitrixClient,
    private readonly plans: PlanRepository,
    private readonly aplications: AplicationRepository,
  ) {}

  async getSubscription(id: string): Promise<Subscription> {
    const response = await this.bitrix.getCrmItem(
      env.payments.spa.subscriptionEntityType,
      id,
    )

    const item = response.result?.item
    if (!item) throw new SubscriptionNotFoundError(id)

    const rawSubscription = mapBitrixSpaSubscriptionToRawSubscription(item)

    const [plan, aplication] = await Promise.all([
      this.plans.getPlan(rawSubscription.planId),
      this.resolveAplication(rawSubscription.aplicationSpaId),
    ])

    return { ...this.withoutIds(rawSubscription), plan, aplication }
  }

  async getSubscriptions(): Promise<Subscription[]> {
    return this.list({})
  }

  async getSubscriptionsByAplication(
    aplicationSpaId: string,
  ): Promise<Subscription[]> {
    return this.list({ [APLICATION_PARENT_FIELD]: aplicationSpaId })
  }

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<Subscription> {
    const response = await this.bitrix.createCrmItem(
      env.payments.spa.subscriptionEntityType,
      mapSubscriptionInputToBitrixFields(input),
    )

    const id = response.result?.item?.id
    if (!id) {
      throw new BitrixError(
        'crm.item.add não devolveu o id da assinatura criada',
      )
    }

    // Releitura de propósito: passa pelo mesmo mapper e pela mesma hidratação,
    // então criação e leitura nunca divergem de shape.
    return this.getSubscription(String(id))
  }

  async updateSubscription(
    id: string,
    patch: UpdateSubscriptionInput,
  ): Promise<Subscription> {
    await this.bitrix.updateCrmItem(
      env.payments.spa.subscriptionEntityType,
      id,
      mapSubscriptionInputToBitrixFields(patch),
    )

    return this.getSubscription(id)
  }

  private async list(filter: Record<string, unknown>): Promise<Subscription[]> {
    const response = await this.bitrix.listCrmItems(
      env.payments.spa.subscriptionEntityType,
      filter,
    )

    const rawSubscriptions = collectBitrixSpaSubscriptionToRawSubscription(
      response.result?.items ?? [],
    )
    if (rawSubscriptions.length === 0) return []

    const [plansById, aplicationsBySpaId] = await Promise.all([
      this.resolvePlans(rawSubscriptions),
      this.resolveAplications(rawSubscriptions),
    ])

    return rawSubscriptions.map(rawSubscription => {
      const plan = plansById.get(rawSubscription.planId)
      if (!plan) throw new PlanNotFoundError(rawSubscription.planId)

      const aplication = aplicationsBySpaId.get(rawSubscription.aplicationSpaId)
      if (!aplication) {
        throw new AplicationNotFoundError(rawSubscription.aplicationSpaId)
      }

      return { ...this.withoutIds(rawSubscription), plan, aplication }
    })
  }

  private async resolvePlans(
    rawSubscriptions: RawSubscription[],
  ): Promise<Map<string, Plan>> {
    const plans = await this.plans.getPlans()
    const plansById = new Map(plans.map(plan => [plan.id, plan]))

    const missingIds = this.distinctMissing(
      rawSubscriptions.map(rawSubscription => rawSubscription.planId),
      plansById,
    )

    const missingPlans = await Promise.all(
      missingIds.map(
        async planId => [planId, await this.plans.getPlan(planId)] as const,
      ),
    )

    for (const [planId, plan] of missingPlans) {
      plansById.set(planId, plan)
    }

    return plansById
  }

  /**
   * Uma resolução por id distinto: várias assinaturas da mesma instalação são o
   * caso comum, e cada resolução carrega uma query no banco mais um lote de
   * títulos no Bitrix.
   */
  private async resolveAplications(
    rawSubscriptions: RawSubscription[],
  ): Promise<Map<string, Aplication>> {
    const spaIds = [
      ...new Set(
        rawSubscriptions.map(
          rawSubscription => rawSubscription.aplicationSpaId,
        ),
      ),
    ]

    const entries = await Promise.all(
      spaIds.map(
        async spaId => [spaId, await this.resolveAplication(spaId)] as const,
      ),
    )

    return new Map(entries)
  }

  /**
   * `null` do lookup é inconsistência de dados, não caso normal: o campo parent
   * aponta para um item de SPA que deveria ter instalação em `core_apps`.
   * Espelha o tratamento de plano ausente — a leitura falha em vez de devolver
   * assinatura sem dono.
   */
  private async resolveAplication(spaId: string): Promise<Aplication> {
    const aplication = await this.aplications.getAplicationBySpaId(spaId)
    if (!aplication) throw new AplicationNotFoundError(spaId)

    return aplication
  }

  private distinctMissing(
    ids: string[],
    resolved: Map<string, unknown>,
  ): string[] {
    return [...new Set(ids.filter(id => !resolved.has(id)))]
  }

  private withoutIds(
    rawSubscription: RawSubscription,
  ): Omit<RawSubscription, 'planId' | 'aplicationSpaId'> {
    const {
      planId: _planId,
      aplicationSpaId: _aplicationSpaId,
      ...subscription
    } = rawSubscription

    return subscription
  }
}
