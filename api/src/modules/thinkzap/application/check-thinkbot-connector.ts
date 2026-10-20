import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import type { Subscription } from '@/modules/application/domain/entities/subscription'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { AplicationNotFoundError } from '@/modules/application/domain/errors/aplication-not-found.error'
import { resolveLineEntitlement } from '@/modules/thinkzap/domain/connector-trial'

type AssinaturaComItens = Pick<Subscription, 'status' | 'currentPeriodEnd'> & {
  items: Pick<SubscriptionItem, 'status'>[]
}

/**
 * ThinkBot exige ao menos uma linha ThinkZap habilitada na instalação (não por canal).
 * Item cancelado não conta: assinatura pode seguir `active` sem linha.
 */
export function hasActiveConnector(
  subscriptions: AssinaturaComItens[],
  now: Date,
): boolean {
  return subscriptions.some(
    subscription =>
      resolveLineEntitlement(subscription, now) === 'active' &&
      subscription.items.some(item => item.status !== 'cancelled'),
  )
}

export class CheckThinkbotConnector {
  constructor(private readonly getAplicationContext: GetAplicationContext) {}

  async execute(
    input: { domainId: string; appCode: string },
    now: Date = new Date(),
  ): Promise<boolean> {
    try {
      const context = await this.getAplicationContext.execute(input)
      return hasActiveConnector(context.subscriptions, now)
    } catch (error) {
      // Instalação sem espelho no CRM não tem o que contratar.
      if (error instanceof AplicationNotFoundError) return false
      throw error
    }
  }
}
