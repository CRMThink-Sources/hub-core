import type { BitrixMethodCaller } from '@/shared/infra/clients/call-bitrix-idempotent'
import { isBitrixApiError } from '@/shared/infra/clients/bitrix-api.error'
import { toSmsSenderCode } from './helpers/sms-sender-code'
import { rethrowAsScopeError } from './helpers/sms-sender-scope-error'

export type DeleteSmsSenderResult = 'deleted' | 'skipped'

const NOT_FOUND_CODES = new Set([
  'ERROR_SENDER_NOT_FOUND',
  'ERROR_NOT_FOUND',
  'SENDER_NOT_FOUND',
])

const NOT_FOUND_MARKERS = ['not found', 'does not exist']

function isSenderNotFoundError(error: unknown): boolean {
  if (!isBitrixApiError(error)) return false

  if (NOT_FOUND_CODES.has(error.code.toUpperCase())) return true

  const text = `${error.description ?? ''} ${error.message}`.toLowerCase()

  return NOT_FOUND_MARKERS.some(marker => text.includes(marker))
}

/**
 * Remove o provedor de mensagem de uma linha do portal do cliente.
 *
 * É a **única** ação que tira o provedor da lista de campanha: esvaziar o handler
 * impede registros novos, mas não apaga o que já está lá.
 *
 * "Não existe" é `skipped`, não erro — a remoção precisa ser repetível, e uma linha
 * cujo provedor nunca foi registrado não é falha. É também o caminho do admin
 * limpando sender órfão de uma linha que já sumiu.
 */
export async function deleteSmsSender(
  client: BitrixMethodCaller,
  subscriptionItemId: string,
): Promise<DeleteSmsSenderResult> {
  return deleteSmsSenderByCode(client, toSmsSenderCode(subscriptionItemId))
}

/**
 * Igual, mas pelo `CODE` cru.
 *
 * Existe para o sender **órfão**: o `CODE` dele não deriva de nenhum item que ainda
 * exista, então não há id de onde derivá-lo de volta.
 */
export async function deleteSmsSenderByCode(
  client: BitrixMethodCaller,
  code: string,
): Promise<DeleteSmsSenderResult> {
  try {
    await client.callMethod('messageservice.sender.delete', { CODE: code })

    return 'deleted'
  } catch (error) {
    if (isSenderNotFoundError(error)) {
      return 'skipped'
    }

    rethrowAsScopeError('messageservice.sender.delete', error)
  }
}
