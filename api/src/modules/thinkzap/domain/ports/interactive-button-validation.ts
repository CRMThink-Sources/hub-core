import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import {
  InvalidButtonCombinationError,
  TooManyButtonsError,
  UnsupportedButtonTypeError,
} from './button-errors'
import { ButtonAction } from './interactive-button-sender.port'

/**
 * Máximo de botões `URL` que a HubMessage aceita por envio: o botão de URL
 * da Meta (`cta_url`) é uma mensagem interativa de um botão só — não existe
 * combinação de vários numa mensagem de sessão livre. Confirmado contra a
 * API real em 2026-09-15.
 */
const HUBMESSAGE_MAX_URL_BUTTONS = 1

/**
 * Máximo de botões `REPLY` (quick reply) que a HubMessage aceita por envio —
 * limite da Cloud API da Meta, não da HubMessage: o 4º botão fez a Meta
 * recusar a mensagem inteira (diferente do `URL` duplicado, que ela descarta
 * em silêncio). Confirmado contra a API real em 2026-09-18.
 */
const HUBMESSAGE_MAX_REPLY_BUTTONS = 3

/**
 * Teto de botões por envio em qualquer provider — decisão de produto, não
 * limite de API: evita mensagens com botões demais para o contato. Os limites
 * da HubMessage acima são menores e prevalecem. Espelhado no front
 * (`MAX_WIDGET_BUTTONS`/`MAX_ROBOT_BUTTONS`).
 */
export const MAX_BUTTONS_PER_SEND = 5

/**
 * Valida a lista de botões contra o que o provider aceita. Fonte única desta
 * regra: usada tanto no pré-check síncrono do enfileiramento (antes de
 * qualquer row nascer) quanto dentro de cada adapter (defesa contra um
 * chamador que pule o pré-check).
 *
 * `HUBMESSAGE` aceita `URL` (até 1) ou `REPLY` (até 3) — nunca os dois no
 * mesmo envio, cada um vai por uma rota diferente da API. Sem ligação
 * (`CALL`, apesar de a doc da HubMessage documentar o tipo: a Cloud API da
 * Meta não tem botão de ligação em mensagem de sessão livre, só em template
 * aprovado). `ZAPI` aceita os três tipos, mas recusa misturar `REPLY` com
 * `CALL`/`URL` no mesmo envio; `CALL` e `URL` entre si podem conviver.
 * Fora da HubMessage (cujo limite já é menor), todo envio fica em
 * `MAX_BUTTONS_PER_SEND`.
 */
export function assertValidButtonsForProvider(
  provider: ConnectorProvider,
  buttons: ButtonAction[],
): void {
  if (provider === ConnectorProvider.HUBMESSAGE) {
    const unsupported = buttons.find(
      button => button.type !== 'URL' && button.type !== 'REPLY',
    )
    if (unsupported) {
      throw new UnsupportedButtonTypeError('HUBMESSAGE', unsupported.type)
    }

    const hasReply = buttons.some(button => button.type === 'REPLY')
    const hasOther = buttons.some(button => button.type !== 'REPLY')
    if (hasReply && hasOther) {
      throw new InvalidButtonCombinationError('HUBMESSAGE')
    }

    const max = hasReply
      ? HUBMESSAGE_MAX_REPLY_BUTTONS
      : HUBMESSAGE_MAX_URL_BUTTONS
    if (buttons.length > max) {
      throw new TooManyButtonsError('HUBMESSAGE', max)
    }
    return
  }

  if (provider === ConnectorProvider.ZAPI) {
    const hasReply = buttons.some(button => button.type === 'REPLY')
    const hasOther = buttons.some(button => button.type !== 'REPLY')
    if (hasReply && hasOther) {
      throw new InvalidButtonCombinationError('ZAPI')
    }
  }

  if (buttons.length > MAX_BUTTONS_PER_SEND) {
    throw new TooManyButtonsError(provider, MAX_BUTTONS_PER_SEND)
  }
}
