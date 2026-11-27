/**
 * Regras puras do aviso de envio: quais disparos são acompanhados e que status
 * cada destinatário mostra.
 *
 * Nada aqui lê banco ou Bitrix, para que o comentário do CRM e a notificação
 * cheguem à mesma conclusão a partir das mesmas rows.
 */

/** Widget e robôs Bizproc. Canal aberto e bot não têm aviso de envio. */
export const TRACKED_SEND_ORIGINS = [
  'WIDGET',
  'WIDGET_ATTACHMENT',
  'ROBOT_MESSAGE',
  'ROBOT_BUTTONS',
  'ROBOT_TEMPLATE',
] as const

export function isTrackedSend(row: {
  origin: string
  smsMessageId: string | null
}): boolean {
  // O template de campanha de SMS usa a origem `WIDGET`: só o `smsMessageId` o
  // distingue, e a campanha já reporta status pelo provedor de SMS do Bitrix.
  if (row.smsMessageId !== null) return false
  return (TRACKED_SEND_ORIGINS as readonly string[]).includes(row.origin)
}

export type RecipientState =
  | 'WAITING'
  | 'SENT'
  | 'FAILED'
  | 'PARTIAL'
  | 'UNKNOWN'

export type SendPart = {
  destination: string
  /** Estado da **fila**: recusa posterior ao aceite não tira a parte de `SENT`. */
  status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'UNKNOWN'
  rejectedAt: Date | null
  lastError: string | null
  failureCode: string | null
  failureReason: string | null
}

export type RecipientSummary = {
  destination: string
  state: RecipientState
  /** A parte que explica o status, em `FAILED`, `PARTIAL` e `UNKNOWN`. */
  failedPart: SendPart | null
}

const isFailed = (part: SendPart) =>
  part.status === 'FAILED' || part.rejectedAt !== null

const isQueued = (part: SendPart) =>
  part.status === 'PENDING' || part.status === 'SENDING'

function summarize(destination: string, parts: SendPart[]): RecipientSummary {
  const failed = parts.find(isFailed)

  if (failed) {
    const delivered = parts.some(
      part => part.status === 'SENT' && !isFailed(part),
    )
    return {
      destination,
      state: delivered ? 'PARTIAL' : 'FAILED',
      failedPart: failed,
    }
  }

  const unknown = parts.find(part => part.status === 'UNKNOWN')

  if (unknown) return { destination, state: 'UNKNOWN', failedPart: unknown }

  return {
    destination,
    state: parts.some(isQueued) ? 'WAITING' : 'SENT',
    failedPart: null,
  }
}

/** Um item por destino, na ordem da primeira aparição. */
export function summarizeRecipients(parts: SendPart[]): RecipientSummary[] {
  const byDestination = new Map<string, SendPart[]>()

  for (const part of parts) {
    const group = byDestination.get(part.destination)
    if (group) group.push(part)
    else byDestination.set(part.destination, [part])
  }

  return Array.from(byDestination, ([destination, group]) =>
    summarize(destination, group),
  )
}

/**
 * A fila terminou todas as partes. Olha as partes, e não o resumo: um
 * destinatário já `FAILED` pode ainda ter parte por sair.
 */
export function isSettled(parts: SendPart[]): boolean {
  return !parts.some(isQueued)
}

/**
 * Destinatários que pedem atenção de quem enviou. `UNKNOWN` conta porque a
 * mensagem pode não ter saído e precisa de conferência antes de um reenvio.
 */
export function failureCount(recipients: RecipientSummary[]): number {
  return recipients.filter(
    ({ state }) =>
      state === 'FAILED' || state === 'PARTIAL' || state === 'UNKNOWN',
  ).length
}
