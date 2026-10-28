import { env } from '@/config/env'
import { ExpiringSubscriptionLister } from '@/modules/application/domain/repositories/expiring-subscription.lister'
import { ExpirableSubscription } from '@/modules/application/domain/subscription-expiration'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { apiLogger } from '@/shared/infra/logger'
import {
  BITRIX_ID_BY_STATUS,
  EXPIRABLE_SUBSCRIPTION_SELECT,
  mapBitrixSpaSubscriptionToExpirable,
} from '../mappers/subscription.mapper'
import { formatCalendarDate } from '../spa-calendar-date'

/**
 * Lê da SPA 1142 os cortes da verificação de assinaturas.
 *
 * O filtro de data de `listExpiring` inclui o dia de hoje e é avaliado pelo Bitrix
 * no fuso do portal — por isso é só o corte grosso. O corte fino, no mesmo instante
 * que a leitura de habilitação usa, é de `resolveExpiredSubscriptionStatus`.
 *
 * Todos paginam pelo `next`: a varredura é sobre a SPA inteira, e uma assinatura
 * fora da primeira página nunca venceria.
 */
export class BitrixExpiringSubscriptionLister implements ExpiringSubscriptionLister {
  constructor(private readonly bitrix: BitrixClient) {}

  listExpiring(now: Date): Promise<ExpirableSubscription[]> {
    return this.listMapped({
      ufCrm91Status: [BITRIX_ID_BY_STATUS.trialing, BITRIX_ID_BY_STATUS.active],
      '<=ufCrm91CurrentPeriodEnd': formatCalendarDate(now),
    })
  }

  listPastDue(): Promise<ExpirableSubscription[]> {
    return this.listMapped({ ufCrm91Status: BITRIX_ID_BY_STATUS.past_due })
  }

  /**
   * `'!campo': ''` seleciona campo de data **preenchido** — conferido contra o portal
   * em 28/10/2026 com `ufCrm91CanceledAt` (`>campo: 2000-01-01` dá o mesmo).
   */
  listWithPastDueAt(): Promise<ExpirableSubscription[]> {
    return this.listMapped({ '!ufCrm91PastDueAt': '' })
  }

  async listActiveIds(): Promise<string[]> {
    const ids: string[] = []
    await this.paginate(
      { ufCrm91Status: BITRIX_ID_BY_STATUS.active },
      ['id'],
      raw => {
        const id = raw?.id
        if (typeof id === 'number' || (typeof id === 'string' && id !== '')) {
          ids.push(String(id))
        }
      },
    )
    return ids
  }

  private async listMapped(
    filter: Record<string, unknown>,
  ): Promise<ExpirableSubscription[]> {
    const subscriptions: ExpirableSubscription[] = []

    await this.paginate(filter, EXPIRABLE_SUBSCRIPTION_SELECT, raw => {
      try {
        subscriptions.push(mapBitrixSpaSubscriptionToExpirable(raw))
      } catch (error) {
        /**
         * Descarta e segue: uma assinatura mal cadastrada não pode impedir as
         * outras de vencerem. Fica para a próxima rodada, se alguém corrigir.
         */
        apiLogger.warn(
          { app: 'shared', subscriptionId: raw?.id, err: error },
          'Assinatura inválida ignorada na verificação de assinaturas',
        )
      }
    })

    return subscriptions
  }

  private async paginate(
    filter: Record<string, unknown>,
    select: string[],
    onItem: (raw: { id?: unknown } | undefined) => void,
  ): Promise<void> {
    let start: number | undefined

    do {
      const response = await this.bitrix.listCrmItems(
        env.payments.spa.subscriptionEntityType,
        filter,
        { select, ...(start !== undefined && { start }) },
      )

      for (const raw of response.result?.items ?? []) onItem(raw)

      start = response.next
    } while (start !== undefined)
  }
}
