import { env } from '@/config/env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import type { SubscriptionItemIdLister } from '@/modules/thinkzap/domain/ports/subscription-item-id-lister.port'
import { SUBSCRIPTION_PARENT_FIELD } from '../mappers/subscription-item.mapper'

/**
 * Lista os ids dos itens de uma assinatura direto da SPA 1146, só o campo `id`, sem
 * mapper e sem cache (ver `SubscriptionItemIdLister`).
 *
 * Pagina pelo `next`, diferente das outras leituras por pai: assinatura com mais de 50
 * linhas é improvável, mas uma linha fora da primeira página aqui é linha paga que
 * nunca seria assinada no provider — e ninguém abriria chamado por isso.
 */
export class BitrixSubscriptionItemIdLister implements SubscriptionItemIdLister {
  constructor(private readonly bitrix: BitrixClient) {}

  async listSubscriptionItemIds(subscriptionId: string): Promise<string[]> {
    const ids: string[] = []
    let start: number | undefined

    do {
      const response = await this.bitrix.listCrmItems(
        env.payments.spa.subscriptionItemEntityType,
        { [SUBSCRIPTION_PARENT_FIELD]: subscriptionId },
        { select: ['id'], ...(start !== undefined && { start }) },
      )

      for (const item of response.result?.items ?? []) {
        // O Bitrix devolve número apesar do tipo; o resto do runtime usa string.
        if (item.id) ids.push(String(item.id))
      }

      start = response.next
    } while (start !== undefined)

    return ids
  }
}
