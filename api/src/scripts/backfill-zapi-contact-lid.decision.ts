/**
 * A decisão do backfill para **um** `chat_id`, separada do script.
 *
 * O script é I/O — Prisma, Z-API, relatório. O que decide o destino de cada contato é
 * isto, e é isto que precisa de teste: uma classificação errada aqui ou deixa um contato
 * sem proteção (ele abre conversa nova quando a flag liga) ou marca como legado alguém
 * que não é.
 */

export type BackfillDecision =
  /** Não é telefone: já é LID, ou é jid de grupo. Nada a proteger. */
  | { kind: 'skip-not-phone' }
  /** Já tem identidade legada gravada. Rodar de novo não mexe. */
  | { kind: 'already-mapped' }
  /** A consulta ao provider não respondeu. Precisa de outra passada. */
  | { kind: 'failed' }
  /** Número sem WhatsApp: sem LID, e sem conversa futura a proteger. */
  | { kind: 'not-on-whatsapp' }
  /** Grava o par e marca a identidade legada. */
  | { kind: 'map'; lid: string; phone: string }

/** `chat_id` que é telefone: só dígitos, no comprimento que a Z-API aceita. */
export function isPhoneLike(chatId: string): boolean {
  return /^\d{8,15}$/.test(chatId)
}

export function decideBackfill(input: {
  chatId: string
  hasLegacyIdentity: boolean
  phoneExists: { exists: boolean; lid: string | null } | null
}): BackfillDecision {
  if (!isPhoneLike(input.chatId)) return { kind: 'skip-not-phone' }
  if (input.hasLegacyIdentity) return { kind: 'already-mapped' }
  if (!input.phoneExists) return { kind: 'failed' }
  if (!input.phoneExists.exists || !input.phoneExists.lid) {
    return { kind: 'not-on-whatsapp' }
  }

  return { kind: 'map', lid: input.phoneExists.lid, phone: input.chatId }
}
