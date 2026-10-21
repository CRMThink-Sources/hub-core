import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import type { MirroredMessageReservations } from '@/modules/thinkzap/infra/cache/mirrored-message-reservations'

/**
 * O que o espelhamento precisa para postar **como o operador da sessão**: o token
 * dele (`ThinkzapOperatorOAuth`, com refresh), um cliente do Bitrix com esse token e
 * a reserva anti-loop.
 */
export type MirrorOperatorAuthor = {
  /** `null` quando o operador nunca autorizou o app. Lança se o refresh falhar. */
  resolveAccessToken(
    domain: string,
    bitrixUserId: string,
  ): Promise<string | null>
  createClient(
    domain: string,
    accessToken: string,
  ): Pick<BitrixClient, 'callMethod'>
  reservations: Pick<
    MirroredMessageReservations,
    'markPending' | 'clearPending' | 'register'
  >
}

/**
 * Corpo de `im.message.add`/`update`/`delete`: o Bitrix recusa com **HTTP 200 +
 * `error`**, não só com status de erro (ver `post-open-channel-system-notice`).
 */
export type ImMessageResponse = {
  result?: number | string | boolean
  error?: string
  error_description?: string
}

/** A razão legível de uma resposta sem `result`. */
export function describeImMessageRefusal(
  response: ImMessageResponse | undefined,
): string {
  return (
    response?.error_description ??
    response?.error ??
    `resposta sem resultado: ${JSON.stringify(response)}`
  )
}
