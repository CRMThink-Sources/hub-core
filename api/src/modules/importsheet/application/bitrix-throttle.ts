/**
 * Throttle do Bitrix24 isolado no módulo importsheet (não toca no client
 * compartilhado). Cobre os dois limites da doc oficial (apidocs.bitrix24.com/limits):
 *
 * 1. Intensidade (leaky bucket) — por IP: estouro → HTTP 503 `QUERY_LIMIT_EXCEEDED`.
 *    Como o limite é por IP (compartilhado entre todas as contas/apps do mesmo
 *    servidor), a reação correta é PAUSAR O WORKER inteiro por um instante
 *    (BullMQ `worker.rateLimit` + `Worker.RateLimitError`).
 * 2. Operating — por conta/método: soma do tempo de execução > 480s em 10min →
 *    método bloqueado pra conta. Como é por conta, a reação é reenfileirar SÓ
 *    esta importação pro fim da fila com delay até `operating_reset_at`, deixando
 *    as outras importações rodarem.
 */

/** Teto de operating do Bitrix (segundos / janela 10min) antes do bloqueio. */
const OPERATING_BUDGET_SECONDS = 480
/** Margem de segurança: pausa antes de encostar no teto de 480s. */
const OPERATING_SAFE_SECONDS = OPERATING_BUDGET_SECONDS - 80
/**
 * Pausa do worker ao tomar 503 de intensidade. O leaky bucket drena ~2/s
 * (não-Enterprise), então alguns segundos esvaziam o burst acumulado.
 */
export const INTENSITY_LIMIT_PAUSE_MS = 10_000
/** Delay padrão de reenfileiramento quando o operating estoura sem reset_at. */
export const OPERATING_DEFAULT_DELAY_MS = 60_000

export type ThrottleSignal =
  | { kind: 'intensity'; pauseMs: number }
  | { kind: 'operating'; resetAt: number | null }

/** Lançada por baixo do writer pra sinalizar 503 de intensidade ao worker. */
export class BitrixThrottleError extends Error {
  constructor(public readonly signal: ThrottleSignal) {
    super(`Bitrix throttle: ${signal.kind}`)
    this.name = 'BitrixThrottleError'
  }
}

/**
 * Detecta 503 `QUERY_LIMIT_EXCEEDED` a partir da `BitrixError` do client
 * compartilhado (que serializa status+corpo na mensagem). Match por marcador
 * pra não depender de tocar no client.
 */
const INTENSITY_MARKERS = ['QUERY_LIMIT_EXCEEDED', 'Bitrix error: 503']

export function isIntensityLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return INTENSITY_MARKERS.some(marker => error.message.includes(marker))
}

/**
 * Bloco de tempo do batch. `operating` (SEGUNDOS) é o acumulado do MÉTODO na
 * janela de 10min. Vem por-comando em `result.result_time[row]` (cada
 * crm.item.add soma no budget do crm.item.add) e/ou no `time` top-level.
 */
export type BatchTime = {
  operating?: number
  operating_reset_at?: number
}

/**
 * Decide se o budget de operating estourou. Olha o MAIOR operating entre as
 * amostras (result_time por-comando + time top-level) — é o mais perto do teto.
 */
export function operatingThrottle(samples: BatchTime[]): ThrottleSignal | null {
  let worst: BatchTime | null = null
  for (const sample of samples) {
    if ((sample?.operating ?? 0) > (worst?.operating ?? -1)) worst = sample
  }
  if (!worst || (worst.operating ?? 0) < OPERATING_SAFE_SECONDS) return null
  return { kind: 'operating', resetAt: worst.operating_reset_at ?? null }
}
