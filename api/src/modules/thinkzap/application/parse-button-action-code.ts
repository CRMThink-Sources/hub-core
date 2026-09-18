import { InteractiveButtonDescriptor } from '@/modules/thinkzap/domain/ports/interactive-button-sender.port'

/**
 * Marca que identifica um texto do canal aberto como um **envio de botões**
 * disparado pela tela de botões do widget do canal aberto — não uma
 * mensagem digitada por um operador de verdade.
 *
 * A tela do canal aberto não sabe o provider da linha (só sabe `dialogId` —
 * ver design.md, Open Questions), então ela não chama o contrato neutro
 * direto: ela posta este código, **como o operador**, no próprio chat do
 * Bitrix (`im.message.add`). Isso dispara `ONIMCONNECTORMESSAGEADD` como
 * qualquer resposta digitada, e é o processor de saída de sempre —
 * `processBitrixReceivedMessage` — quem resolve provider e destino (já faz
 * isso para toda mensagem) e detecta este código antes do texto virar
 * mensagem livre.
 *
 * O prefixo nunca deveria chegar ao contato: o processor intercepta antes de
 * qualquer chamada ao provider. Se a decodificação falhar mesmo assim, o
 * job SHALL falhar sem enviar o texto cru — nunca cair no caminho de texto
 * livre com o código por dentro.
 */
export const BUTTON_ACTION_CODE_PREFIX = '##THINKZAP_BUTTON_ACTION##'

export function isButtonActionCode(text: string): boolean {
  return text.startsWith(BUTTON_ACTION_CODE_PREFIX)
}

/** Base64 por cima do JSON: evita que quebra de linha ou aspas do corpo quebrem o transporte do Bitrix. */
export function encodeButtonActionCode(
  descriptor: InteractiveButtonDescriptor,
): string {
  const json = JSON.stringify(descriptor)
  const encoded = Buffer.from(json, 'utf8').toString('base64')
  return `${BUTTON_ACTION_CODE_PREFIX}${encoded}`
}

/**
 * `null` quando o texto não tem o prefixo (mensagem comum de operador) OU
 * quando tem o prefixo mas o payload não decodifica. Os dois casos são
 * tratados diferente por quem chama — `isButtonActionCode` distingue "não é
 * código" de "é código quebrado" — mas nenhum dos dois pode virar texto cru
 * enviado ao contato.
 */
export function decodeButtonActionCode(
  text: string,
): InteractiveButtonDescriptor | null {
  if (!isButtonActionCode(text)) return null

  const encoded = text.slice(BUTTON_ACTION_CODE_PREFIX.length)

  try {
    const json = Buffer.from(encoded, 'base64').toString('utf8')
    const parsed = JSON.parse(json) as unknown
    return isInteractiveButtonDescriptor(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isInteractiveButtonDescriptor(
  value: unknown,
): value is InteractiveButtonDescriptor {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.body === 'string' &&
    Array.isArray(candidate.buttons) &&
    candidate.buttons.length > 0 &&
    candidate.buttons.every(
      button =>
        button &&
        typeof button === 'object' &&
        typeof (button as Record<string, unknown>).label === 'string' &&
        ['REPLY', 'URL', 'CALL'].includes(
          (button as Record<string, unknown>).type as string,
        ),
    )
  )
}
