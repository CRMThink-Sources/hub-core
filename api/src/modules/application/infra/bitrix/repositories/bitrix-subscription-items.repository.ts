import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import {
  CreateSubscriptionItemInput,
  SubscriptionItemRepository,
  UpdateSubscriptionItemInput,
} from '@/modules/application/domain/repositories/subscription-item.repository'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { SubscriptionItemNotFoundError } from '@/modules/application/domain/errors/subscription-item-not-found.error'
import { env } from '@/config/env'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import {
  SUBSCRIPTION_PARENT_FIELD,
  collectBitrixSpaSubscriptionItemToSubscriptionItem,
  mapBitrixSpaSubscriptionItemToSubscriptionItem,
  mapSubscriptionItemInputToBitrixFields,
} from '../mappers/subscription-item.mapper'

/**
 * Só o `BitrixClient` no construtor: diferente de plano e assinatura, o item não
 * hidrata nenhuma outra entidade — `subscription` fica sendo o id do pai — então
 * não há repositório a injetar.
 */
export class BitrixSubscriptionItemRepository implements SubscriptionItemRepository {
  constructor(private readonly bitrix: BitrixClient) {}

  async getSubscriptionItem(id: string): Promise<SubscriptionItem> {
    const response = await this.bitrix.getCrmItem(
      env.payments.spa.subscriptionItemEntityType,
      id,
    )

    const item = response.result?.item
    if (!item) throw new SubscriptionItemNotFoundError(id)

    return mapBitrixSpaSubscriptionItemToSubscriptionItem(item)
  }

  async getSubscriptionItems(): Promise<SubscriptionItem[]> {
    return this.list({})
  }

  async getSubscriptionItemsBySubscription(
    subscriptionId: string,
  ): Promise<SubscriptionItem[]> {
    return this.list({ [SUBSCRIPTION_PARENT_FIELD]: subscriptionId })
  }

  async createSubscriptionItem(
    input: CreateSubscriptionItemInput,
  ): Promise<SubscriptionItem> {
    /**
     * Item nasce com os quatro toggles explícitos no campo. O default é resolvido
     * aqui, e não no mapper, porque o mapper serve criação e patch com a mesma
     * função e não sabe distinguir "não informado numa criação" (vira default) de
     * "não informado num patch" (não toca no campo).
     */
    const response = await this.bitrix.createCrmItem(
      env.payments.spa.subscriptionItemEntityType,
      mapSubscriptionItemInputToBitrixFields({
        ...input,
        settings: input.settings ?? { ...DEFAULT_CONNECTOR_SETTINGS },
      }),
    )

    const id = response.result?.item?.id
    if (!id) {
      throw new BitrixError(
        'crm.item.add não devolveu o id do item de assinatura criado',
      )
    }

    // Releitura de propósito: passa pelo mesmo mapper que a leitura, então
    // criação e leitura nunca divergem de shape.
    return this.getSubscriptionItem(String(id))
  }

  async updateSubscriptionItem(
    id: string,
    patch: UpdateSubscriptionItemInput,
  ): Promise<SubscriptionItem> {
    await this.bitrix.updateCrmItem(
      env.payments.spa.subscriptionItemEntityType,
      id,
      mapSubscriptionItemInputToBitrixFields(patch),
    )

    return this.getSubscriptionItem(id)
  }

  /**
   * Listagem sem leitura extra por item: o mapper é puro, então uma chamada a
   * `crm.item.list` resolve a coleção inteira. Item inválido propaga o erro em
   * vez de ser omitido — dado de cobrança faltando em silêncio é pior que falha.
   */
  private async list(
    filter: Record<string, unknown>,
  ): Promise<SubscriptionItem[]> {
    const response = await this.bitrix.listCrmItems(
      env.payments.spa.subscriptionItemEntityType,
      filter,
    )

    return collectBitrixSpaSubscriptionItemToSubscriptionItem(
      response.result?.items ?? [],
    )
  }
}
