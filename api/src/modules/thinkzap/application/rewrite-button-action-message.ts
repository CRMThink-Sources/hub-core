import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import type { InteractiveButtonDescriptor } from '@/modules/thinkzap/domain/ports/interactive-button-sender.port'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

const log = createWorkerSourceLogger('bitrix')

/**
 * Monta o texto legível (BBCode nativo do Bitrix) que substitui o código de
 * `parse-button-action-code.ts` na timeline do operador, depois de decodificado.
 */
export function buildButtonActionBbcode(
  descriptor: InteractiveButtonDescriptor,
): string {
  const lines = [
    '[B]Botões enviados[/B]',
    ...(descriptor.header ? [descriptor.header] : []),
    descriptor.body,
    ...(descriptor.footer ? [descriptor.footer] : []),
    '',
    ...descriptor.buttons.map(button => `▫️ ${button.label}`),
  ]

  return lines.join('\n')
}

/**
 * Reescreve, via `im.message.update`, a mensagem que a tela de botões do
 * canal aberto postou como o operador (código base64 de
 * `parse-button-action-code.ts`) por um texto legível — só cosmético, roda
 * depois do envio já confirmado ao contato.
 *
 * Nunca lança: falhar aqui não pode virar erro de processamento de um envio
 * que já foi entregue. `im.message.update` também pode recusar por permissão
 * — o `bitrixClient` daqui é o do app, não o token do operador que postou a
 * mensagem original — e esse caso é só observabilidade, não incidente.
 */
export async function rewriteButtonActionMessage(
  bitrixClient: BitrixClient,
  bitrixMessageId: string,
  descriptor: InteractiveButtonDescriptor,
): Promise<void> {
  try {
    await bitrixClient.callMethod('im.message.update', {
      MESSAGE_ID: bitrixMessageId,
      MESSAGE: buildButtonActionBbcode(descriptor),
    })
  } catch (err) {
    logThinkzapError(
      log,
      'thinkzap.message.button_action_rewrite_failed',
      { bitrixMessageId, err },
      {
        level: 'warn',
        msg: 'Failed to rewrite button action code into a readable message',
      },
    )
  }
}
