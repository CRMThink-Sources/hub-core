import { sharedSendPhrases } from '@/modules/thinkzap/domain/notices/send-comment'
import type { NoticeLocale } from '@/modules/thinkzap/domain/notices/notice-locale'
import type {
  RecipientState,
  RecipientSummary,
  SendPart,
} from '@/modules/thinkzap/domain/send-notice'
import { summarizeRecipients } from '@/modules/thinkzap/domain/send-notice'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import {
  describeSendFailure,
  toSendPart,
} from '@/modules/thinkzap/application/helpers/send-failure'

/**
 * Peças comuns da lista e do detalhe da aba Envios: o que cada linha mostra a
 * partir das rows do outbox. Mantido num lugar só para a lista e o detalhe
 * nunca contarem a mesma falha de dois jeitos.
 */

export type SendKind = 'text' | 'template' | 'buttons' | 'attachment'
export type SendOrigin = 'widget' | 'robot'

/** Estados que pedem um motivo ao lado do status. */
const REASON_STATES: readonly RecipientState[] = [
  'FAILED',
  'PARTIAL',
  'UNKNOWN',
]

export function sendKindOf(part: WidgetOutboxRecord): SendKind {
  if (part.kind === 'TEMPLATE') return 'template'
  if (part.kind === 'INTERACTIVE_BUTTON') return 'buttons'
  if (part.kind === 'MEDIA') return 'attachment'
  return 'text'
}

/**
 * O tipo do envio: o da primeira parte, mas um grupo com anexo é "anexo" mesmo
 * que o texto venha antes (widget com texto e anexos). Template manda: um
 * template com mídia continua sendo o template que o operador escolheu.
 */
export function groupKindOf(parts: WidgetOutboxRecord[]): SendKind {
  const head = parts[0]
  if (!head) return 'text'
  const kind = sendKindOf(head)
  if (kind === 'template') return kind
  return parts.some(part => part.kind === 'MEDIA') ? 'attachment' : kind
}

export function sendOriginOf(part: WidgetOutboxRecord): SendOrigin {
  return part.origin.startsWith('ROBOT_') ? 'robot' : 'widget'
}

/** Um destinatário por item: o resumo único das partes. */
export function summarizeParts(
  parts: WidgetOutboxRecord[],
): RecipientSummary | null {
  return summarizeRecipients(parts.map(toSendPart))[0] ?? null
}

/**
 * Motivo para o estado, no idioma da instalação; `null` quando o estado não é de
 * falha. Nunca devolve texto vazio.
 */
export function failureReasonFor(
  summary: RecipientSummary,
  locale: NoticeLocale,
): string | null {
  if (!REASON_STATES.includes(summary.state)) return null
  const phrases = sharedSendPhrases(locale)
  // Sem confirmação nunca mostra o erro cru (ex.: "timeout of 30000ms exceeded"):
  // ele parece falha e convida ao reenvio, mas a mensagem pode ter sido entregue.
  if (summary.state === 'UNKNOWN') return phrases.unknownAction
  const described = summary.failedPart
    ? describeSendFailure(locale)(summary.failedPart).trim()
    : ''
  return described !== '' ? described : phrases.unreportedReason
}

/** Estado e motivo de uma parte sozinha (a lista de partes do detalhe). */
export function describePart(
  part: WidgetOutboxRecord,
  locale: NoticeLocale,
): { status: RecipientState; failureReason: string | null } {
  const sendPart: SendPart = toSendPart(part)
  const summary = summarizeRecipients([sendPart])[0]
  if (!summary) return { status: 'SENT', failureReason: null }
  return {
    status: summary.state,
    failureReason: failureReasonFor(summary, locale),
  }
}
