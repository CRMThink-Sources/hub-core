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
 *
 * **Por que o código fica junto do texto legível, e não é editado depois.**
 * `ONIMCONNECTORMESSAGEADD` só carrega `message.text`/`message.files` — sem
 * campo estruturado (`ATTACH`/`params`) pra esconder o código à parte. E
 * reescrever a mensagem depois (`im.message.update`) exige o token de quem
 * a postou; o processor só tem a credencial do app, então a edição é
 * recusada pelo Bitrix na prática. Por isso o texto já nasce pronto: preview
 * legível (BBCode nativo do Bitrix) seguido do código, em letra miúda,
 * claramente rotulado como interno.
 */
export const BUTTON_ACTION_CODE_PREFIX = '##THINKZAP_BUTTON_ACTION##'

/** Só os caracteres possíveis em base64 — corta qualquer BBCode/texto que venha depois do código. */
const BASE64_RUN = /^[A-Za-z0-9+/=]+/

export function isButtonActionCode(text: string): boolean {
  return text.includes(BUTTON_ACTION_CODE_PREFIX)
}

/** Preview em BBCode nativo do Bitrix — o que o operador realmente lê na timeline. */
function buildReadablePreview(descriptor: InteractiveButtonDescriptor): string {
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
 * Preview legível + base64 do JSON por cima, num rodapé em letra miúda.
 * Base64 continua necessário para o payload: evita que quebra de linha ou
 * aspas do corpo do operador quebrem o transporte do Bitrix.
 */
export function encodeButtonActionCode(
  descriptor: InteractiveButtonDescriptor,
): string {
  const json = JSON.stringify(descriptor)
  const encoded = Buffer.from(json, 'utf8').toString('base64')
  const preview = buildReadablePreview(descriptor)

  return (
    `${preview}\n\n` +
    `[SIZE=1]Código interno — não editar: ${BUTTON_ACTION_CODE_PREFIX}${encoded}[/SIZE]`
  )
}

/**
 * `null` quando o texto não tem o marcador (mensagem comum de operador) OU
 * quando tem o marcador mas o payload não decodifica. Os dois casos são
 * tratados diferente por quem chama — `isButtonActionCode` distingue "não é
 * código" de "é código quebrado" — mas nenhum dos dois pode virar texto cru
 * enviado ao contato.
 */
export function decodeButtonActionCode(
  text: string,
): InteractiveButtonDescriptor | null {
  const markerIndex = text.lastIndexOf(BUTTON_ACTION_CODE_PREFIX)
  if (markerIndex === -1) return null

  const rest = text.slice(markerIndex + BUTTON_ACTION_CODE_PREFIX.length)
  const encoded = rest.match(BASE64_RUN)?.[0] ?? ''

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
