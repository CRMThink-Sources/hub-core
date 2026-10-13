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
 * Lê da SPA 1142 as assinaturas `Em teste` e `Ativo` com o fim do período até hoje.
 *
 * O filtro de data inclui o dia de hoje e é avaliado pelo Bitrix no fuso do portal
 * — por isso é só o corte grosso. O corte fino, no mesmo instante que a leitura de
 * habilitação usa, é de `resolveExpiredSubscriptionStatus`.
 *
 * Pagina pelo `next`: a varredura é sobre a SPA inteira, e uma assinatura fora da
 * primeira página nunca venceria.
 */
export class BitrixExpiringSubscriptionLister implements ExpiringSubscriptionLister {
  constructor(private readonly bitrix: BitrixClient) {}

  async listExpiring(now: Date): Promise<ExpirableSubscription[]> {
    const filter = {
      ufCrm91Status: [BITRIX_ID_BY_STATUS.trialing, BITRIX_ID_BY_STATUS.active],
      '<=ufCrm91CurrentPeriodEnd': formatCalendarDate(now),
    }

    const subscriptions: ExpirableSubscription[] = []
    let start: number | undefined

    do {
      const response = await this.bitrix.listCrmItems(
        env.payments.spa.subscriptionEntityType,
        filter,
        {
          select: EXPIRABLE_SUBSCRIPTION_SELECT,
          ...(start !== undefined && { start }),
        },
      )

      for (const raw of response.result?.items ?? []) {
        try {
          subscriptions.push(mapBitrixSpaSubscriptionToExpirable(raw))
        } catch (error) {
          /**
           * Descarta e segue: uma assinatura mal cadastrada não pode impedir as
           * outras de vencerem. Fica para a próxima rodada, se alguém corrigir.
           */
          apiLogger.warn(
            { app: 'shared', subscriptionId: raw?.id, err: error },
            'Assinatura inválida ignorada na varredura de expiração',
          )
        }
      }

      start = response.next
    } while (start !== undefined)

    return subscriptions
  }
}
