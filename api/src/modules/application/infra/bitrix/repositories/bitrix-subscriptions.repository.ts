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
import { apiLogger } from '@/shared/infra/logger'
import { InvalidBitrixPlanError } from '../errors/invalid-bitrix-plan.error'
import { InvalidBitrixSubscriptionError } from '../errors/invalid-bitrix-subscription.error'
import { listAllCrmItems } from '../list-all-crm-items'
import {
  APLICATION_PARENT_FIELD,
  BITRIX_ID_BY_STATUS,
  RawSubscription,
  STATUS_BY_BITRIX_ID,
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

  /**
   * Tolerante a assinatura ilegível (data de período vazia, status fora do mapa, plano
   * inexistente): ela é pulada e logada, em vez de derrubar a leitura da instalação
   * inteira — lista de linhas, widget e roteamento das linhas que estão em dia.
   *
   * Esconder uma assinatura não pode liberar contratação nova: os caminhos de escrita
   * perguntam `countUnreadableSubscriptionsByAplication` antes.
   */
  async getSubscriptionsByAplication(
    aplicationSpaId: string,
  ): Promise<Subscription[]> {
    return (await this.readByAplication(aplicationSpaId)).subscriptions
  }

  async countUnreadableSubscriptionsByAplication(
    aplicationSpaId: string,
  ): Promise<number> {
    return (await this.readByAplication(aplicationSpaId)).unreadableIds.length
  }

  private async readByAplication(aplicationSpaId: string): Promise<{
    subscriptions: Subscription[]
    unreadableIds: string[]
  }> {
    const raws = await listAllCrmItems(
      this.bitrix,
      env.payments.spa.subscriptionEntityType,
      { [APLICATION_PARENT_FIELD]: aplicationSpaId },
    )

    const unreadableIds: string[] = []
    const unreadable = (id: unknown, error: unknown, status?: unknown) => {
      // Ilegível mas encerrada (cancelada, teste expirado) não é contrato vivo: contar
      // bloquearia trial e contratação da instalação para sempre por causa de lixo.
      const known = STATUS_BY_BITRIX_ID[String(status)]
      if (known !== 'cancelled' && known !== 'trial_expired') {
        unreadableIds.push(String(id))
      }
      apiLogger.error(
        { app: 'shared', subscriptionId: id, aplicationSpaId, err: error },
        'Assinatura ilegível ignorada na leitura da instalação — corrigir o item na SPA 1142',
      )
    }

    const parsed: RawSubscription[] = []
    for (const raw of raws) {
      try {
        parsed.push(mapBitrixSpaSubscriptionToRawSubscription(raw))
      } catch (error) {
        if (!(error instanceof InvalidBitrixSubscriptionError)) throw error
        const fields = raw as { id?: unknown; ufCrm91Status?: unknown }
        unreadable(fields?.id, error, fields?.ufCrm91Status)
      }
    }

    if (parsed.length === 0) return { subscriptions: [], unreadableIds }

    const [plansById, aplication] = await Promise.all([
      this.resolvePlans(parsed, { tolerant: true }),
      this.resolveAplication(aplicationSpaId),
    ])

    const subscriptions: Subscription[] = []
    for (const rawSubscription of parsed) {
      const plan = plansById.get(rawSubscription.planId)
      if (!plan) {
        unreadable(
          rawSubscription.id,
          new PlanNotFoundError(rawSubscription.planId),
          BITRIX_ID_BY_STATUS[rawSubscription.status],
        )
        continue
      }
      subscriptions.push({
        ...this.withoutIds(rawSubscription),
        plan,
        aplication,
      })
    }

    return { subscriptions, unreadableIds }
  }

  /**
   * Filtra pelo campo de id do gateway na SPA e devolve **todas** as que casam.
   *
   * Mais de uma é caso de negócio, não inconsistência: uma instalação cobrada por
   * dois planos tem uma assinatura por plano, as duas com o mesmo id no gateway.
   * Devolver a primeira faria o webhook escrever status em metade do contrato — e
   * metade das linhas do cliente ficaria bloqueada por metade de um `past_due`.
   */
  async listSubscriptionsByGatewayId(
    gatewayId: string,
  ): Promise<Subscription[]> {
    return this.list({ ufCrm91GatewayId: gatewayId })
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
    const rawSubscriptions = collectBitrixSpaSubscriptionToRawSubscription(
      await listAllCrmItems(
        this.bitrix,
        env.payments.spa.subscriptionEntityType,
        filter,
      ),
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

  /**
   * `tolerant`: plano inexistente ou inválido fica fora do mapa em vez de lançar, e
   * quem chama decide o que fazer com a assinatura sem plano.
   */
  private async resolvePlans(
    rawSubscriptions: RawSubscription[],
    options: { tolerant?: boolean } = {},
  ): Promise<Map<string, Plan>> {
    const plans = await this.plans.getPlans()
    const plansById = new Map(plans.map(plan => [plan.id, plan]))

    const missingIds = this.distinctMissing(
      rawSubscriptions.map(rawSubscription => rawSubscription.planId),
      plansById,
    )

    const missingPlans = await Promise.all(
      missingIds.map(async planId => {
        try {
          return [planId, await this.plans.getPlan(planId)] as const
        } catch (error) {
          const isConfiguration =
            error instanceof PlanNotFoundError ||
            error instanceof InvalidBitrixPlanError
          if (options.tolerant && isConfiguration) return null
          throw error
        }
      }),
    )

    for (const entry of missingPlans) {
      if (entry) plansById.set(entry[0], entry[1])
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
