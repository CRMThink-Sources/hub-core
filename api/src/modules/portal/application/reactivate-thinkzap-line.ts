import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { makeSubscriptionItemRepository } from '@/modules/application/main/make-subscription-item-repository'
import { AppContextDeps } from '@/modules/thinkzap/application/helpers/list-line-items-for-app'
import { resolveAdminLine } from './helpers/resolve-admin-line'

export class ThinkzapLineNotInactiveError extends Error {
  constructor(subscriptionItemId: string) {
    super(`Linha "${subscriptionItemId}" não está cancelada`)
    this.name = 'ThinkzapLineNotInactiveError'
  }
}

/**
 * Reativa uma linha cancelada, gravando `status: 'active'` no item da SPA.
 *
 * Antes era transição de `Connector.status` (`INACTIVE` → `ACTIVE`), uma coluna de row
 * que a linha pode não ter — reativar o que não existe não tem resultado observável.
 * `SubscriptionItem.status` é o par honesto: `cancelled`/`active`, na fonte onde a linha
 * de fato existe.
 *
 * **Reativar não concede habilitação.** `resolveLineEntitlement` deriva da assinatura
 * pai, então linha reativada sob trial vencido continua bloqueada. É o comportamento
 * pretendido: status do item é "esta linha foi cancelada?", não "esta linha está paga?".
 *
 * O patch leva **só** o status. `updateSubscriptionItem` é parcial e o mapper escreve
 * apenas as chaves presentes, então credencial, `ufCrm93Settings` e `ufCrm93Conector`
 * ficam intactos — reativar não pode custar ao cliente os ajustes que ele fez.
 */
export async function reactivateThinkzapLine(
  appId: string,
  subscriptionItemId: string,
  deps?: AppContextDeps,
  items: SubscriptionItemRepository = makeSubscriptionItemRepository(),
): Promise<SubscriptionItem> {
  const item = await resolveAdminLine(appId, subscriptionItemId, deps)

  if (item.status !== 'cancelled') {
    throw new ThinkzapLineNotInactiveError(subscriptionItemId)
  }

  return items.updateSubscriptionItem(item.id, { status: 'active' })
}
