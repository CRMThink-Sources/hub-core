import type { RecipientState, RecipientSummary, SendPart } from '../send-notice'
import type { NoticeLocale } from './notice-locale'
import {
  bbField,
  bbLines,
  bbMessage,
  bbTitle,
  escapeBbcode,
} from './timeline-format'
import {
  bbFileFields,
  timelineLabels,
  type SendRobotFilesResult,
} from './timeline-notices'

/**
 * Comentário de timeline de um disparo e a notificação de quem enviou. Funções puras:
 * o comentário é remontado inteiro a cada mudança de status, então repetir é seguro.
 *
 * Destino, texto, nome de template, arquivo e motivo do provedor são dado: passam por
 * `escapeBbcode`, direto ou pelos helpers de `timeline-format`.
 */

/** Acima disto o comentário resume por estado e detalha só o que pede atenção. */
const DETAILED_RECIPIENTS_LIMIT = 20

export type SendCommentInput = {
  locale: NoticeLocale
  kind: 'message' | 'template' | 'buttons'
  /** Disparo de robô do Bizproc; muda o título de envio concluído. */
  automation: boolean
  fromPhone: string
  template?: { name: string; language: string }
  text: string
  recipients: RecipientSummary[]
  files?: SendRobotFilesResult
  /** Motivo legível da parte que explica a falha, no idioma de `locale`. */
  describeFailure: (part: SendPart) => string
}

type SendCopy = {
  status: string
  states: Record<RecipientState, string>
  /** Título quando o disparo não tem um desfecho único para afirmar. */
  neutralTitle: string
  /** Nomeia a mensagem: a do widget usa "ela", logo abaixo do texto citado. */
  unknownAction: string
  alertTitle: string
  alertFailed: string
  alertUnknown: string
  reason: string
  /** No lugar do motivo quando a parte falhou sem erro registrado. */
  unreportedReason: string
  openRecord: string
}

/**
 * Frases do comentário que a aba Envios reaproveita, para lista, detalhe e
 * comentário do CRM dizerem a mesma coisa.
 */
export function sharedSendPhrases(locale: NoticeLocale): {
  unknownAction: string
  unreportedReason: string
} {
  const { unknownAction, unreportedReason } = COPY[locale]
  return { unknownAction, unreportedReason }
}

const COPY: Record<NoticeLocale, SendCopy> = {
  pt: {
    status: 'Status',
    states: {
      WAITING: 'Aguardando envio',
      SENT: 'Enviado',
      DELIVERED: 'Entregue',
      READ: 'Lido',
      FAILED: 'Falhou',
      PARTIAL: 'Falhou em parte',
      UNKNOWN: 'Sem confirmação',
    },
    neutralTitle: 'Envio de mensagem',
    unknownAction:
      'Confira a conversa com o contato ANTES de reenviar — a mensagem pode ter sido entregue.',
    alertTitle: 'ThinkZap: confira o envio',
    alertFailed: 'Destinatários com falha no envio',
    alertUnknown: 'Destinatários sem confirmação de envio',
    reason: 'Motivo',
    unreportedReason: 'motivo não informado',
    openRecord: 'Abrir o registro',
  },
  en: {
    status: 'Status',
    states: {
      WAITING: 'Waiting to be sent',
      SENT: 'Sent',
      DELIVERED: 'Delivered',
      READ: 'Read',
      FAILED: 'Failed',
      PARTIAL: 'Partially failed',
      UNKNOWN: 'Not confirmed',
    },
    neutralTitle: 'Message send',
    unknownAction:
      'Check the conversation with the contact BEFORE resending — the message may have been delivered.',
    alertTitle: 'ThinkZap: check this send',
    alertFailed: 'Recipients with a failed send',
    alertUnknown: 'Recipients with an unconfirmed send',
    reason: 'Reason',
    unreportedReason: 'reason not reported',
    openRecord: 'Open the record',
  },
  es: {
    status: 'Estado',
    states: {
      WAITING: 'Esperando envío',
      SENT: 'Enviado',
      DELIVERED: 'Entregado',
      READ: 'Leído',
      FAILED: 'Falló',
      PARTIAL: 'Falló en parte',
      UNKNOWN: 'Sin confirmación',
    },
    neutralTitle: 'Envío de mensaje',
    unknownAction:
      'Revise la conversación con el contacto ANTES de reenviar — el mensaje puede haber sido entregado.',
    alertTitle: 'ThinkZap: revise el envío',
    alertFailed: 'Destinatarios con falla en el envío',
    alertUnknown: 'Destinatarios sin confirmación de envío',
    reason: 'Motivo',
    unreportedReason: 'motivo no informado',
    openRecord: 'Abrir el registro',
  },
}

/** O motivo vem cru do provedor: uma quebra de linha tiraria o status do rodapé. */
const singleLine = (value: string) => value.replace(/\s+/g, ' ').trim()

/**
 * Enviado, entregue e lido são o mesmo desfecho bom: o provedor aceitou e nada
 * falhou. Ficam de fora da lista individual e juntos no título; só falha,
 * parcial e desconhecido pedem atenção do atendente.
 */
const isSentGroup = (state: RecipientState) =>
  state === 'SENT' || state === 'DELIVERED' || state === 'READ'

/** Estado do destinatário, com o motivo quando houve falha. Ainda sem escape. */
function stateText(
  input: SendCommentInput,
  { state, failedPart }: RecipientSummary,
): string {
  const { states, unreportedReason } = COPY[input.locale]
  const label = states[state]
  const failed = state === 'FAILED' || state === 'PARTIAL'
  if (!failed || !failedPart) return label
  // Parte que falhou sem `lastError` deixaria "Falhou: " com o motivo em branco.
  const reason = singleLine(input.describeFailure(failedPart))
  return `${label}: ${reason || unreportedReason}`
}

function recipientLine(
  input: SendCommentInput,
  recipient: RecipientSummary,
): string {
  return escapeBbcode(
    `${recipient.destination} — ${stateText(input, recipient)}`,
  )
}

function stateTotals({ locale, recipients }: SendCommentInput): string[] {
  const { states } = COPY[locale]
  return (Object.keys(states) as RecipientState[]).flatMap(state => {
    const count = recipients.filter(r => r.state === state).length
    return count > 0 ? [`${states[state]}: ${count}`] : []
  })
}

/** Rodapé: o status é sempre o fim do comentário. */
function statusLines(input: SendCommentInput): string[] {
  const { status, unknownAction } = COPY[input.locale]
  const [only, ...others] = input.recipients

  if (only && others.length === 0) {
    const text = stateText(input, only)
    return [
      bbField(
        status,
        // O motivo do provedor pode já terminar em ponto.
        only.hasUnconfirmed
          ? `${text.replace(/\.+$/, '')}. ${unknownAction}`
          : text,
      ),
    ]
  }

  const summarized = input.recipients.length > DETAILED_RECIPIENTS_LIMIT
  const detailed = summarized
    ? input.recipients.filter(
        ({ state }) => state !== 'WAITING' && !isSentGroup(state),
      )
    : input.recipients

  return [
    bbTitle(`${status}:`),
    ...(summarized ? stateTotals(input) : []),
    ...detailed.map(recipient => recipientLine(input, recipient)),
    // Uma vez só: repetida em cada linha, a orientação afogaria a lista.
    ...(input.recipients.some(r => r.hasUnconfirmed) ? [unknownAction] : []),
  ]
}

/** O título só afirma um desfecho que vale para todos os destinatários. */
function commentTitle({
  locale,
  automation,
  recipients,
}: SendCommentInput): string {
  const labels = timelineLabels(locale)
  // `every` é verdadeiro em lista vazia, que não tem desfecho nenhum.
  const all = (match: (state: RecipientState) => boolean) =>
    recipients.length > 0 && recipients.every(r => match(r.state))

  if (all(isSentGroup)) return automation ? labels.robotTitle : labels.sentTitle
  // "Falha no envio" convidaria a reenviar o que talvez tenha saído.
  if (
    all(state => state === 'FAILED') &&
    !recipients.some(r => r.hasUnconfirmed)
  ) {
    return labels.failedTitle
  }
  if (all(state => state === 'UNKNOWN')) return labels.unknownTitle
  return COPY[locale].neutralTitle
}

export function renderSendComment(input: SendCommentInput): string {
  const labels = timelineLabels(input.locale)
  const [first] = input.recipients
  const to =
    first && input.recipients.length === 1
      ? first.destination
      : String(input.recipients.length)

  return bbLines([
    bbTitle(commentTitle(input)),
    bbField(labels.from, input.fromPhone),
    bbField(labels.to, to),
    input.template
      ? bbField(
          labels.template,
          `${input.template.name} (${input.template.language})`,
        )
      : undefined,
    bbMessage(labels.message, input.text),
    ...(input.files ? bbFileFields(labels, input.files) : []),
    ...statusLines(input),
  ])
}

export function renderSendAlert(input: {
  locale: NoticeLocale
  failed: number
  unknown: number
  /** Só quando todas as falhas têm o mesmo motivo. */
  reason: string | null
  recordUrl: string | null
}): string {
  const copy = COPY[input.locale]
  // Colchete no endereço fecharia a tag `[URL=...]` antes da hora.
  const url = input.recordUrl?.replace(/\[/g, '%5B').replace(/\]/g, '%5D')

  return bbLines([
    bbTitle(copy.alertTitle),
    input.failed > 0 ? `${copy.alertFailed}: ${input.failed}` : undefined,
    // O motivo é das falhas: fica colado nelas, e não nas sem confirmação.
    input.reason ? bbField(copy.reason, singleLine(input.reason)) : undefined,
    // Sem confirmação não é falha: a mensagem pode ter saído.
    input.unknown > 0 ? `${copy.alertUnknown}: ${input.unknown}` : undefined,
    input.unknown > 0 ? copy.unknownAction : undefined,
    url ? `[URL=${url}]${copy.openRecord}[/URL]` : undefined,
  ])
}
