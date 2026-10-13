import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { env } from '@/config/env'
import { BitrixSubscriptionItemIdLister } from '@/modules/application/infra/bitrix/readers/bitrix-subscription-item-id.lister'
import { SyncSubscriptionLinesBilling } from '@/modules/thinkzap/application/sync-subscription-lines-billing'
import { makeSyncSpaItemResourceStatus } from './make-sync-spa-item-resource-status'

/**
 * Monta a cobrança das linhas de uma assinatura editada na SPA 1142.
 *
 * O caso de uso por item é o mesmo do UPDATE do item (`makeSyncSpaItemResourceStatus`),
 * montado uma vez e reaproveitado em todos os itens do job. A listagem é crua, no portal
 * interno — o mesmo onde as SPAs de billing vivem.
 */
export const makeSyncSubscriptionLinesBilling =
  (): SyncSubscriptionLinesBilling =>
    new SyncSubscriptionLinesBilling(
      new BitrixSubscriptionItemIdLister(
        new BitrixClient({ webhook: env.crmthinkWebhookUrl }),
      ),
      makeSyncSpaItemResourceStatus(),
    )
