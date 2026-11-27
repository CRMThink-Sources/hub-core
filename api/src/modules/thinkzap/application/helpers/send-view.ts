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

/**
 * Frase para falha sem motivo registrado (sem recusa da Meta, sem erro da fila):
 * a tela nunca mostra um motivo vazio. `UNKNOWN` tem a sua porque ali o que se
 * sabe é que faltou confirmação, não que algo falhou.
 */
const GENERIC_REASON: Record<
  NoticeLocale,
  { failed: string; unknown: string }
> = {
  pt: {
    failed: 'O envio falhou e o provedor não informou o motivo.',
    unknown:
      'Sem confirmação do provedor. Confira a conversa antes de reenviar.',
  },
  en: {
    failed: 'The send failed and the provider gave no reason.',
    unknown:
      'No confirmation from the provider. Check the conversation before resending.',
  },
  es: {
    failed: 'El envío falló y el proveedor no informó el motivo.',
    unknown:
      'Sin confirmación del proveedor. Revise la conversación antes de reenviar.',
  },
}

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
  const described = summary.failedPart
    ? describeSendFailure(locale)(summary.failedPart).trim()
    : ''
  if (described !== '') return described
  const generic = GENERIC_REASON[locale]
  return summary.state === 'UNKNOWN' ? generic.unknown : generic.failed
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
