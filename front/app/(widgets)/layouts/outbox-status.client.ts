/**
 * Acompanhamento, no widget, das mensagens enviadas pela fila da linha.
 *
 * Com o cadenciador, uma mensagem aceita pode esperar a janela de envio — e sem esta
 * leitura o operador veria só "na fila" e não saberia quando ela sai. Lógica pura,
 * fora do componente, para ser testável sem DOM.
 */

export type OutboxStatus = 'queued' | 'waiting' | 'sent' | 'failed' | 'unknown'

export type OutboxStatusEntry = {
  clientMessageId: string
  status: OutboxStatus
  /** ISO; só em `waiting`. */
  waitUntil: string | null
}

/** Intervalo da consulta enquanto há mensagem sem desfecho. */
export const OUTBOX_STATUS_POLL_MS = 5_000

const FINAL: ReadonlySet<OutboxStatus> = new Set(['sent', 'failed', 'unknown'])

export function isFinalStatus(status: OutboxStatus): boolean {
  return FINAL.has(status)
}

/** Ids da resposta de qualquer rota de envio: um (`clientMessageId`) ou vários. */
export function clientMessageIdsOf(response: unknown): string[] {
  if (typeof response !== 'object' || response === null) return []
  const body = response as {
    clientMessageId?: unknown
    clientMessageIds?: unknown
  }
  if (Array.isArray(body.clientMessageIds)) {
    return body.clientMessageIds.filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    )
  }
  return typeof body.clientMessageId === 'string' && body.clientMessageId
    ? [body.clientMessageId]
    : []
}

/** A resposta do envio com anexo é da fila (`202`) ou do caminho síncrono antigo. */
export function isQueuedResponse(response: unknown): boolean {
  return (
    typeof response === 'object' &&
    response !== null &&
    (response as { status?: unknown }).status === 'queued'
  )
}

/** Quem ainda precisa ser consultado. Id sem leitura ainda conta como pendente. */
export function pendingIds(
  tracked: string[],
  statuses: Record<string, OutboxStatusEntry>,
): string[] {
  return tracked.filter(id => {
    const entry = statuses[id]
    return !entry || !isFinalStatus(entry.status)
  })
}

/** HH:mm no horário de Brasília — o mesmo dos avisos do servidor. */
export function formatWaitTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

/** O texto de uma mensagem acompanhada. O widget é só em português. */
export function describeOutboxStatus(
  entry: OutboxStatusEntry | undefined,
): string {
  if (!entry) return 'Na fila de envio'
  switch (entry.status) {
    case 'waiting':
      return entry.waitUntil
        ? `Aguardando janela de envio · sai às ${formatWaitTime(entry.waitUntil)}`
        : 'Aguardando janela de envio'
    case 'sent':
      return 'Enviada'
    case 'failed':
      return 'Não entregue — veja o aviso na timeline'
    case 'unknown':
      return 'Entrega não confirmada — veja o aviso na timeline'
    default:
      return 'Na fila de envio'
  }
}

/** URL da consulta, com os ids que ainda não terminaram. */
export function outboxStatusUrl(ids: string[]): string {
  return `/thinkzap/messages/outbox-status?ids=${ids.map(encodeURIComponent).join(',')}`
}

/** Junta a leitura nova ao que já se sabia, por id. */
export function mergeStatuses(
  current: Record<string, OutboxStatusEntry>,
  response: { messages?: OutboxStatusEntry[] } | null | undefined,
): Record<string, OutboxStatusEntry> {
  const next = { ...current }
  for (const entry of response?.messages ?? []) {
    next[entry.clientMessageId] = entry
  }
  return next
}
