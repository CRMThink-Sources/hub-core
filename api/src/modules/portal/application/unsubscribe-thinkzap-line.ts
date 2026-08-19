import { AppContextDeps } from '@/modules/thinkzap/application/helpers/list-line-items-for-app'
import { resolveAdminLine } from './helpers/resolve-admin-line'
import {
  hubMessageClient,
  zApiClient,
  zApiCredential,
} from './subscribe-thinkzap-line'

/**
 * Cancela a assinatura do recurso no provider — o par de `subscribeThinkzapLine`.
 *
 * Cancelar o recurso não cancela a cobrança: a assinatura da SPA 1142 continua como
 * está, e o item continua sendo linha. Quem cancela cobrança é o fluxo de billing.
 */
export async function unsubscribeThinkzapLine(
  appId: string,
  subscriptionItemId: string,
  deps?: AppContextDeps,
): Promise<void> {
  const item = await resolveAdminLine(appId, subscriptionItemId, deps)

  if (item.metadata.provider === 'HUBMESSAGE') {
    await hubMessageClient().cancelChannel(
      item.metadata.hubmessageChannelId,
      'Cancelamento de assinatura',
    )
    return
  }

  const { instanceId, token } = zApiCredential(item)
  await zApiClient().unsubscribe(instanceId, token)
}
