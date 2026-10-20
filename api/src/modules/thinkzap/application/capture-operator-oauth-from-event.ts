import type { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import type { UpsertOperatorBitrixOAuth } from './upsert-operator-bitrix-oauth'

/** TTL do token de evento quando `expires_in` vem vazio ou ilegível. */
const DEFAULT_EXPIRES_IN_SECONDS = 3600

export type CaptureOperatorOAuthOutcome =
  | { captured: true; bitrixUserId: string }
  | { captured: false; reason: string }

/**
 * Guarda o token do operador que veio no `auth` do `ONIMCONNECTORMESSAGEADD`, para o
 * espelhamento poder postar como ele depois.
 *
 * **Complemento, não fonte.** A fonte é a autorização feita pelos widgets
 * (`ThinkzapOperatorOAuth`). Pela doc do evento, `refresh_token` é opcional e os
 * tokens "not always passed" — sem refresh, um `access_token` de 1h não serve para
 * postar horas depois, então não é gravado.
 *
 * Só grava quando `auth.user_id` é o autor da mensagem: o `auth` é de quem disparou o
 * evento (`auth_type: '0'`), e gravar o token de outro usuário sob o id do autor
 * faria o espelho postar como a pessoa errada.
 *
 * **Nunca lança.** Roda no caminho de envio ao contato; falhar aqui não pode impedir
 * a resposta do operador de sair.
 */
export async function captureOperatorOAuthFromEvent(
  upsert: Pick<UpsertOperatorBitrixOAuth, 'execute'>,
  params: {
    appId: string
    auth: IBX24MessageEvent['auth']
    messageUserId: string | number
  },
): Promise<CaptureOperatorOAuthOutcome> {
  const { auth } = params
  const authorId = String(params.messageUserId)

  if (!auth.access_token || !auth.refresh_token) {
    return { captured: false, reason: 'evento sem access_token/refresh_token' }
  }
  if (!auth.user_id || String(auth.user_id) !== authorId) {
    return {
      captured: false,
      reason: `auth.user_id=${auth.user_id || '—'} não é o autor (${authorId})`,
    }
  }

  const expiresIn = Number(auth.expires_in)

  try {
    await upsert.execute({
      appId: params.appId,
      bitrixUserId: authorId,
      accessToken: auth.access_token,
      refreshToken: auth.refresh_token,
      expiresIn:
        Number.isFinite(expiresIn) && expiresIn > 0
          ? expiresIn
          : DEFAULT_EXPIRES_IN_SECONDS,
    })
    return { captured: true, bitrixUserId: authorId }
  } catch (err) {
    return {
      captured: false,
      reason: `falha ao gravar: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
