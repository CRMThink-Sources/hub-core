import type { DailyLimitPolicy } from '@/modules/thinkzap/domain/daily-send-limit'

/** Contagem do dia de uma linha. */
export type DailySendCounts = {
  sent: number
  extra: number
}

/** Vaga reservada para um envio. Devolver é idempotente. */
export type DailyQuotaReservation = {
  /** Devolve a vaga ao dia em que foi reservada — não ao dia de quando é chamada. */
  release: () => Promise<void>
}

export type DailyQuotaReserveResult =
  | { status: 'reserved'; reservation: DailyQuotaReservation }
  | { status: 'refused'; counts: DailySendCounts; effectiveLimit: number }

/**
 * Contador diário de envio por linha.
 *
 * `reserve` decide e conta **num passo só**: "checar e depois contar" em dois deixa
 * duas mensagens passarem na última vaga. Com o limite desligado, a reserva só conta —
 * é o que permite ao cliente ver o volume real antes de ativar.
 */
export interface DailySendQuota {
  reserve(policy: DailyLimitPolicy, now: Date): Promise<DailyQuotaReserveResult>
  /** Leitura sem reservar, para recusar cedo (enfileiramento). */
  wouldRefuse(policy: DailyLimitPolicy, now: Date): Promise<boolean>
  /** Soma extras **ao dia de `now`**. Devolve a contagem atualizada. */
  addExtra(lineKey: string, amount: number, now: Date): Promise<DailySendCounts>
  /**
   * Zera o uso **do dia de `now`**: contagem e extras. Devolve o que havia antes,
   * para o registro de quem zerou e quanto.
   */
  resetDay(lineKey: string, now: Date): Promise<DailySendCounts>
  usage(lineKey: string, now: Date): Promise<DailySendCounts>
}
