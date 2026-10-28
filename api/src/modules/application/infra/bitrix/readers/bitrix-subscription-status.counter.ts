import { env } from '@/config/env'
import {
  SubscriptionStatusCounter,
  SubscriptionStatusCounts,
} from '@/modules/application/domain/repositories/subscription-status.counter'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BITRIX_ID_BY_STATUS } from '../mappers/subscription.mapper'

/**
 * Conta as assinaturas da SPA 1142 por status com o `total` do `crm.item.list`.
 *
 * Uma chamada por status, em paralelo, pedindo só o `id`: o `total` já é a contagem
 * do filtro, então não há paginação — a primeira página basta.
 */
export class BitrixSubscriptionStatusCounter implements SubscriptionStatusCounter {
  constructor(
    private readonly bitrix: Pick<BitrixClient, 'listCrmItems'>,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async count(): Promise<SubscriptionStatusCounts> {
    const [active, pastDue, trialing] = await Promise.all([
      this.countStatus(BITRIX_ID_BY_STATUS.active),
      this.countStatus(BITRIX_ID_BY_STATUS.past_due),
      this.countStatus(BITRIX_ID_BY_STATUS.trialing),
    ])

    return { active, pastDue, trialing, countedAt: this.clock() }
  }

  private async countStatus(statusId: string): Promise<number> {
    const response = await this.bitrix.listCrmItems(
      env.payments.spa.subscriptionEntityType,
      { ufCrm91Status: statusId },
      { select: ['id'] },
    )

    // Sem `total` (resposta fora do contrato) a primeira página seria uma contagem
    // errada que parece certa — melhor falhar e o painel mostrar "indisponível".
    if (typeof response.total !== 'number') {
      throw new Error('crm.item.list sem total na contagem de assinaturas')
    }
    return response.total
  }
}
