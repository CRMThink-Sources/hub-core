import {
  ensureSmsSender,
  type EnsureSmsSenderResult,
} from '@/modules/thinkzap/application/ensure-sms-sender'
import type { AppContextDeps } from '@/modules/thinkzap/application/helpers/list-line-items-for-app'
import { resolveAdminLine } from './helpers/resolve-admin-line'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type RegisterSmsProviderForAppOutput = {
  result: EnsureSmsSenderResult
}

/**
 * Registra o provedor de mensagem **de uma linha** no Bitrix do cliente.
 *
 * Par registrar/remover no mesmo formato do robô de Bizproc e do widget, com uma
 * diferença que é toda a change: a chave é a **linha**, não o app. O `CODE` do sender
 * deriva do id do item, e é por ele que o handler da campanha reencontra a linha —
 * o payload que o Bitrix entrega não carrega nada mais.
 *
 * A linha é resolvida **antes** do cliente do Bitrix: item inexistente ou item que não
 * é linha recusa sem gastar refresh de token nem chamada ao portal.
 *
 * Não checa habilitação, como o resto das ações de linha do admin: registrar o
 * provedor de uma linha de trial vencido é operação legítima de suporte, e o bloqueio
 * de cobrança morde no **envio** — o handler da campanha recusa por habilitação, que é
 * onde a regra tem efeito.
 */
export async function registerSmsProviderForApp(
  appId: string,
  subscriptionItemId: string,
  deps?: AppContextDeps,
): Promise<RegisterSmsProviderForAppOutput> {
  const item = await resolveAdminLine(appId, subscriptionItemId, deps)
  const { client } = await resolveBitrixClientForApp(appId)

  return { result: await ensureSmsSender(client, { item }) }
}
