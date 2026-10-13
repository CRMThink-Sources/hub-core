import { env } from '@/config/env'
import type { Subscription } from '@/modules/application/domain/entities/subscription'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import type { SubscriptionStatusReader } from '@/modules/thinkzap/domain/ports/subscription-status-reader.port'
import { mapBitrixSpaSubscriptionToRawSubscription } from '../mappers/subscription.mapper'

/**
 * O status de uma assinatura lido direto da SPA 1142, sem cache e sem hidratar plano e
 * aplicação (ver `SubscriptionStatusReader`).
 *
 * Passa pelo mapper cru, e não por um parser próprio: o mapa de status do enum mora lá, e
 * um segundo mapa aqui se dessincronizaria no dia em que a SPA ganhasse um status. Item
 * que o mapper recusa propaga — é SPA reconfigurada, e esconder isso como "assinatura
 * inexistente" deixaria linha paga sem assinar sem rastro.
 */
export class BitrixSubscriptionStatusReader implements SubscriptionStatusReader {
  constructor(private readonly bitrix: BitrixClient) {}

  async getSubscriptionStatus(
    subscriptionId: string,
  ): Promise<Subscription['status'] | null> {
    const response = await this.bitrix.getCrmItem(
      env.payments.spa.subscriptionEntityType,
      subscriptionId,
    )

    const item = response.result?.item
    if (!item) return null

    return mapBitrixSpaSubscriptionToRawSubscription(item).status
  }
}
