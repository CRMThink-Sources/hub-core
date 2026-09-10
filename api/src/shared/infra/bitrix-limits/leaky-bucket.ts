/**
 * Leaky bucket do Bitrix: cada chamada soma 1, o contador cai `Y`/s, passar de `X`
 * devolve 503 `QUERY_LIMIT_EXCEEDED`. Contamos igual e esperamos antes de estourar.
 *
 * Puro — o Redis só guarda o estado. O balde é por portal, compartilhado entre apps.
 */

export type BucketLimits = {
  /** Quanto o contador cai por segundo (`Y`). */
  drainPerSecond: number
  /** Teto antes do bloqueio (`X`). */
  capacity: number
}

/** Enterprise é 5/250, mas calibrar por ele estouraria o resto do parque. */
export const DEFAULT_BUCKET_LIMITS: BucketLimits = {
  drainPerSecond: 2,
  capacity: 50,
}

export const ENTERPRISE_BUCKET_LIMITS: BucketLimits = {
  drainPerSecond: 5,
  capacity: 250,
}

export type BucketState = {
  /** Contador no instante `updatedAtMs`. */
  level: number
  updatedAtMs: number
}

export type BucketDecision = {
  /** Quanto esperar antes de mandar a chamada. `0` = manda agora. */
  waitMs: number
  /** Estado a persistir, já com esta chamada contada. */
  state: BucketState
}

export const emptyBucket = (nowMs: number): BucketState => ({
  level: 0,
  updatedAtMs: nowMs,
})

/** Nível do contador agora, aplicando a vazão desde a última atualização. */
export function drain(
  state: BucketState,
  nowMs: number,
  limits: BucketLimits,
): number {
  const elapsedSeconds = Math.max(0, nowMs - state.updatedAtMs) / 1000
  return Math.max(0, state.level - elapsedSeconds * limits.drainPerSecond)
}

/**
 * Reserva uma chamada, devolvendo espera em vez de recusa — atrasar é melhor que
 * falhar num atendimento em curso.
 *
 * Conta sempre, mesmo com espera: contar depois abriria janela para dois workers
 * reservarem o mesmo espaço.
 */
export function reserve(
  state: BucketState,
  nowMs: number,
  limits: BucketLimits = DEFAULT_BUCKET_LIMITS,
  cost = 1,
): BucketDecision {
  const level = drain(state, nowMs, limits)
  const after = level + cost

  if (after <= limits.capacity) {
    return { waitMs: 0, state: { level: after, updatedAtMs: nowMs } }
  }

  // Espera o excedente vazar: retry em cima do limite é o que piora o estouro.
  const excess = after - limits.capacity
  const waitMs = Math.ceil((excess / limits.drainPerSecond) * 1000)

  return {
    waitMs,
    state: { level: limits.capacity, updatedAtMs: nowMs + waitMs },
  }
}
