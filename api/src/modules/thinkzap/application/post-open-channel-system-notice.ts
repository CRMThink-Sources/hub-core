import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'

const log = createWorkerSourceLogger('bitrix')

/**
 * Corpo comum de `imbot.message.add` e `im.message.add`: `result` é o id da mensagem
 * criada, e o Bitrix recusa com **HTTP 200 + `error`** — nunca com status de erro.
 */
type MessageAddResponse = {
  result?: number | string | false
  error?: string
  error_description?: string
}

export type SystemNoticeAttempt = { method: string; reason: string }

export type SystemNoticeOutcome =
  | { posted: true; method: string; bitrixMessageId: string }
  /** Toda tentativa e o que o Bitrix respondeu em cada uma. */
  | { posted: false; attempts: SystemNoticeAttempt[] }

/**
 * Posta um **aviso de sistema** no chat do canal aberto: texto de serviço, cinza, sem
 * autor humano e sem notificação.
 *
 * `SYSTEM: 'Y'` não é cosmético. As duas alternativas são piores:
 *
 * - `imconnector.send.messages` faria o aviso aparecer como fala do **contato** —
 *   histórico com texto que ele nunca escreveu.
 * - mensagem normal (`SYSTEM: 'N'`) entra atribuída ao bot ou ao usuário do app, como se
 *   um operador tivesse falado com o cliente.
 *
 * **Duas tentativas, nesta ordem, porque a primeira falha em canal aberto.** Medido em
 * produção (2026-08-18, portal `crmthinkers`, chat 9474): `imbot.message.add` devolveu
 * `200 { error: 'CANCELED', error_description: 'Você não pode enviar mensagens para o
 * bate-papo especificado.' }`. O guard é de escrita no chat: o bot supervisor do
 * conector não é participante da sessão de OL, e o Bitrix recusa antes de olhar
 * `SYSTEM`.
 *
 * A segunda tentativa posta pelo usuário do app (`im.message.add`), que é quem detém a
 * credencial da instalação. Como vai com `SYSTEM: 'Y'`, o resultado é o mesmo texto de
 * serviço — não uma mensagem assinada por uma pessoa.
 *
 * A ordem é essa e não a inversa porque bot é o autor "certo" de aviso de conector
 * quando o portal permite; cair para o usuário do app é o remendo, e o log diz qual dos
 * dois funcionou (`method`), para não ficarmos adivinhando depois.
 *
 * **Nunca lança.** Chamada em caminhos onde o desfecho já aconteceu e retentar não muda
 * nada; falhar aqui só trocaria "aviso perdido" por "job falho".
 */
export async function postOpenChannelSystemNotice(
  bitrixClient: BitrixClient,
  params: { botId: number; bitrixChatId: string; text: string },
): Promise<SystemNoticeOutcome> {
  const dialogId = `chat${params.bitrixChatId}`

  const candidates: Array<{
    method: string
    payload: Record<string, unknown>
  }> = [
    {
      method: 'imbot.message.add',
      payload: {
        BOT_ID: params.botId,
        DIALOG_ID: dialogId,
        MESSAGE: params.text,
        SYSTEM: 'Y',
      },
    },
    {
      method: 'im.message.add',
      payload: {
        DIALOG_ID: dialogId,
        MESSAGE: params.text,
        SYSTEM: 'Y',
      },
    },
  ]

  const attempts: SystemNoticeAttempt[] = []

  for (const { method, payload } of candidates) {
    try {
      const response = await bitrixClient.callMethod<MessageAddResponse>(
        method,
        payload,
      )
      const messageId = response?.result

      if (messageId) {
        log.info(
          {
            dialogId,
            method,
            bitrixMessageId: String(messageId),
            systemNoticeSent: true,
          },
          'System notice posted to open channel chat',
        )
        return { posted: true, method, bitrixMessageId: String(messageId) }
      }

      const reason =
        response?.error_description ??
        response?.error ??
        `resposta sem id de mensagem: ${JSON.stringify(response)}`

      log.warn(
        { dialogId, method, bitrixResponse: response },
        'Bitrix aceitou a chamada mas não criou a mensagem de sistema',
      )
      attempts.push({ method, reason })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      log.warn({ dialogId, method, err }, 'Falha ao postar mensagem de sistema')
      attempts.push({ method, reason })
    }
  }

  return { posted: false, attempts }
}

/** Uma linha legível com o que cada tentativa respondeu, para log de job. */
export function describeSystemNoticeAttempts(
  attempts: SystemNoticeAttempt[],
): string {
  return attempts.map(a => `${a.method}: ${a.reason}`).join(' | ')
}
