import { AppContextDeps } from '@/modules/thinkzap/application/helpers/list-line-items-for-app'
import { ProviderEffectsDisabledError } from '../domain/errors/portal-domain.errors'
import { resolveAdminLine } from './helpers/resolve-admin-line'
import {
  LineBillingEffects,
  defaultLineBillingEffects,
  hubMessageClient,
  zApiClient,
  zApiCredential,
} from './subscribe-thinkzap-line'

/**
 * Cancela a assinatura do recurso no provider — o par de `subscribeThinkzapLine`.
 *
 * Cancelar o recurso não cancela a cobrança: a assinatura da SPA 1142 continua como
 * está, e o item continua sendo linha. Quem cancela cobrança é o fluxo de billing.
 *
 * Força a chamada e grava a marca de desassinado depois do sucesso, como o par. Com a
 * assinatura e o item ativos, o próximo UPDATE do item assina de novo: é a regra do
 * ciclo, e a tela avisa isso na confirmação.
 */
export async function unsubscribeThinkzapLine(
  appId: string,
  subscriptionItemId: string,
  deps?: AppContextDeps,
  effects: LineBillingEffects = defaultLineBillingEffects(),
): Promise<void> {
  if (!effects.providerEffectsEnabled) throw new ProviderEffectsDisabledError()

  const item = await resolveAdminLine(appId, subscriptionItemId, deps)

  if (item.metadata.provider === 'HUBMESSAGE') {
    await hubMessageClient().cancelChannel(
      item.metadata.hubmessageChannelId,
      'Cancelamento de assinatura',
    )
  } else {
    const { instanceId, token } = zApiCredential(item)
    await zApiClient().unsubscribe(instanceId, token)
  }

  await effects.mirrors.setBillingState(item.id, 'unsubscribed')
}
