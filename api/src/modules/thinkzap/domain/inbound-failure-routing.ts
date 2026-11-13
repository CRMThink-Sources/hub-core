/**
 * Origens dos jobs da fila `thinkzap-inbound` (a união de `ThinkzapInboundJob`).
 */
export type InboundSource =
  | 'z-api'
  | 'bitrix'
  | 'hubmessage'
  | 'hubmessage-status'
  | 'bitrix-bot'

/**
 * Onde o evento aponta para um portal. O `body` nem sempre traz o portal: só o Bitrix
 * traz o nome; a Z-API e a HubMessage trazem um id do provider que precisa de lookup
 * (instância por `instanceId`/`channel_id`). Cada campo ausente fica `undefined`.
 */
export type InboundRouting = {
  /** Nome do portal Bitrix (`auth.domain` / `domain`). */
  domainName?: string
  /** Id da instância **na Z-API** (não o id interno). */
  zApiInstanceId?: string
  /** Canal da HubMessage. */
  channelId?: string
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/**
 * Lê do `body` de um evento recebido o que identifica o portal, sem lançar: o
 * `body` vem de fora e é por isso que uma falha de recebimento existe — um campo
 * malformado aqui não pode esconder a falha original.
 */
export function extractInboundRouting(
  source: string,
  body: unknown,
): InboundRouting {
  const data = asRecord(body)
  if (!data) return {}

  switch (source) {
    case 'z-api': {
      const zApiInstanceId = asNonEmptyString(data.instanceId)
      return zApiInstanceId ? { zApiInstanceId } : {}
    }
    case 'hubmessage':
    case 'hubmessage-status': {
      const channelId = asNonEmptyString(data.channel_id)
      return channelId ? { channelId } : {}
    }
    case 'bitrix': {
      const domainName = asNonEmptyString(asRecord(data.auth)?.domain)
      return domainName ? { domainName } : {}
    }
    case 'bitrix-bot': {
      const domainName = asNonEmptyString(data.domain)
      return domainName ? { domainName } : {}
    }
    default:
      return {}
  }
}

/**
 * Origens cuja reentrega do mesmo evento não repete efeito externo, e que portanto o
 * portal pode reprocessar. Uma origem só entra aqui depois de provada idempotente
 * (ver `design.md`, "Levantamento"):
 *
 * - `hubmessage`: guarda por `_id` antes de entregar ao canal aberto, escrita para
 *   reentrega de webhook.
 *
 * Fora de propósito: `z-api` (sem guarda antes de entregar ao Bitrix), `hubmessage-status`
 * (repete aviso ao operador e status da campanha), `bitrix` (reenviaria, editaria ou
 * apagaria no WhatsApp do contato) e `bitrix-bot` (executa o fluxo do bot).
 */
export const REPROCESSABLE_INBOUND_SOURCES: readonly InboundSource[] = [
  'hubmessage',
]

export function isReprocessableInboundSource(source: string): boolean {
  return (REPROCESSABLE_INBOUND_SOURCES as readonly string[]).includes(source)
}

/**
 * `jobId` do evento reprocessado. Não reaproveita o do job falho: ele continua no
 * Redis por 7 dias e o BullMQ devolveria o antigo em vez de criar o novo. O id da falha
 * de origem vai dentro dele para que, se o reprocessado falhar de novo, a nova falha
 * seja ligada a esta (`previousFailureId`) sem mexer no payload do job.
 */
export function reprocessJobId(failureId: string, reprocessCount: number) {
  return `reprocess-${failureId}-${reprocessCount}`
}

const REPROCESS_JOB_ID = /^reprocess-([0-9a-f-]{36})-\d+$/i

/** A falha de origem de um job reprocessado, ou `null` para um job comum. */
export function previousFailureIdOf(jobId: string): string | null {
  return REPROCESS_JOB_ID.exec(jobId)?.[1] ?? null
}

function pick(value: unknown): string | undefined {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : undefined
}

/**
 * Os poucos campos do `body` que o detalhe da falha mostra ao suporte. O `body` inteiro
 * tem dado pessoal (telefone do contato, texto da mensagem, nome), e entender a falha
 * não precisa dele: precisa de quem recebeu e de qual mensagem. Lista fechada por
 * origem, só valores simples — nunca o JSON.
 */
export function describeInboundPayload(
  source: string,
  body: unknown,
): Record<string, string> {
  const data = asRecord(body)
  if (!data) return {}

  const fields: Record<string, string | undefined> =
    source === 'z-api'
      ? { instanceId: pick(data.instanceId), messageId: pick(data.messageId) }
      : source === 'hubmessage' || source === 'hubmessage-status'
        ? { channelId: pick(data.channel_id), messageId: pick(data._id) }
        : source === 'bitrix'
          ? {
              domain: pick(asRecord(data.auth)?.domain),
              line: pick(asRecord(data.data)?.LINE),
            }
          : source === 'bitrix-bot'
            ? { domain: pick(data.domain) }
            : {}

  return Object.fromEntries(
    Object.entries(fields).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  )
}
