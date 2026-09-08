import type { MessageDirectionCounts } from './get-thinkzap-home-message-stats'

export const ZERO_COUNTS: MessageDirectionCounts = { sent: 0, received: 0 }

export function sumCounts(
  a: MessageDirectionCounts,
  b: MessageDirectionCounts,
): MessageDirectionCounts {
  return { sent: a.sent + b.sent, received: a.received + b.received }
}

export type Trend =
  | { kind: 'up'; percent: number }
  | { kind: 'down'; percent: number }
  | { kind: 'flat' }
  | { kind: 'new' }

/**
 * Variação percentual entre o período atual e o anterior.
 *
 * `previous = 0` não vira divisão por zero: sem base de comparação, o rótulo é
 * "novo" (chegou volume onde antes não tinha nenhum) em vez de "+∞%" ou erro.
 * Os dois zerados é "flat" — nada mudou, inclusive a ausência de mensagens.
 */
export function percentChange(current: number, previous: number): Trend {
  if (previous === 0) {
    return current === 0 ? { kind: 'flat' } : { kind: 'new' }
  }

  const percent = ((current - previous) / previous) * 100
  if (percent === 0) return { kind: 'flat' }
  return percent > 0
    ? { kind: 'up', percent }
    : { kind: 'down', percent: Math.abs(percent) }
}
