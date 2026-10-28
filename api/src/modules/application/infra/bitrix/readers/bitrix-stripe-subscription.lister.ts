import { env } from '@/config/env'
import type {
  StripeSubscriptionLister,
  StripeSubscriptionRef,
} from '@/modules/thinkzap/domain/ports/stripe-subscription-lister.port'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { SUBSCRIPTION_MODALITY_FIELD } from '../ensure-subscription-modality-field'

const ENVIRONMENT_FIELD = 'ufCrm91Environment'

const text = (value: unknown): string | null =>
  (typeof value === 'string' || typeof value === 'number') &&
  String(value).trim() !== ''
    ? String(value).trim()
    : null

/**
 * As assinaturas Stripe da SPA 1142 para a sincronização: só id, id do gateway e
 * ambiente. Não passa pelo `SubscriptionRepository` porque aquele hidrata plano e
 * aplicação e lança por qualquer um faltando — uma assinatura mal cadastrada pararia
 * a sincronização das outras. O estado de cada uma é relido por id do gateway na hora
 * de aplicar.
 */
export class BitrixStripeSubscriptionLister implements StripeSubscriptionLister {
  constructor(private readonly bitrix: Pick<BitrixClient, 'listCrmItems'>) {}

  async listStripeSubscriptions(): Promise<StripeSubscriptionRef[]> {
    const refs: StripeSubscriptionRef[] = []
    let start: number | undefined

    do {
      const response = await this.bitrix.listCrmItems(
        env.payments.spa.subscriptionEntityType,
        { [SUBSCRIPTION_MODALITY_FIELD]: 'stripe' },
        {
          select: ['id', 'ufCrm91GatewayId', ENVIRONMENT_FIELD],
          ...(start !== undefined && { start }),
        },
      )

      for (const raw of response.result?.items ?? []) {
        const record = raw as Record<string, unknown>
        const id = text(record.id)
        if (!id) continue
        refs.push({
          id,
          gatewayId: text(record.ufCrm91GatewayId),
          environment: text(record[ENVIRONMENT_FIELD]),
        })
      }

      start = response.next
    } while (start !== undefined)

    return refs
  }
}
