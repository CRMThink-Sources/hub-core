import {
  deleteSmsSender,
  type DeleteSmsSenderResult,
} from '@/modules/thinkzap/application/delete-sms-sender'
import type { AppContextDeps } from '@/modules/thinkzap/application/helpers/list-line-items-for-app'
import { resolveAdminLine } from './helpers/resolve-admin-line'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type DeleteSmsProviderForAppOutput = {
  result: DeleteSmsSenderResult
}

/**
 * Remove o provedor de mensagem de uma linha do Bitrix do cliente.
 *
 * Simétrico do registro, e é o **único** caminho que tira o provedor da tela de
 * campanha: esvaziar `BITRIX_SMS_HANDLER_URL` impede registros novos e não apaga
 * nenhum dos já feitos.
 *
 * Provedor ausente devolve `skipped` e `200`, não erro: rollback tem de ser repetível,
 * e linha que nunca teve provedor registrado não é falha.
 */
export async function deleteSmsProviderForApp(
  appId: string,
  subscriptionItemId: string,
  deps?: AppContextDeps,
): Promise<DeleteSmsProviderForAppOutput> {
  const item = await resolveAdminLine(appId, subscriptionItemId, deps)
  const { client } = await resolveBitrixClientForApp(appId)

  return { result: await deleteSmsSender(client, item.id) }
}
