/**
 * Orçamento de tempo de execução (`operating`), por método e por app.
 *
 * O Bitrix soma o tempo gasto em cada método em 10 cestas de um minuto. Passar do
 * teto devolve 429 `OPERATION_TIME_LIMIT` **naquele método, para o app inteiro** — e
 * é aí que o estrago passa do bot: se a leitura de assinatura no CRM esquentar, o
 * ThinkZap perde linha, settings e envio junto.
 *
 * Toda resposta traz `time.operating` e `operating_reset_at`. Dá para desviar antes
 * do 429 em vez de descobrir depois.
 */

/** Teto do cloud. O self-hosted usa 420s quando ligado, e desligado por padrão. */
export const OPERATING_LIMIT_SECONDS = 480

/** A partir de quanto do teto já vale parar de mandar esse método. */
export const OPERATING_WARN_RATIO = 0.85

export type OperatingTime = {
  operating?: number
  operating_reset_at?: number
}

export type OperatingReading = {
  /** Segundos acumulados no método. */
  operating: number
  /** Quando a cesta mais velha sai da conta, em ms epoch. `null` = não informado. */
  resetAtMs: number | null
  ratio: number
  /** Já passou do ponto de recuar. */
  exhausted: boolean
}

/** `null` = a resposta não trouxe o bloco `time` (webhook, mock, self-hosted). */
export function readOperating(
  time: OperatingTime | undefined,
  limitSeconds = OPERATING_LIMIT_SECONDS,
): OperatingReading | null {
  const operating = time?.operating
  if (typeof operating !== 'number' || !Number.isFinite(operating)) return null

  const resetAt = time?.operating_reset_at
  const ratio = limitSeconds > 0 ? operating / limitSeconds : 0

  return {
    operating,
    resetAtMs:
      typeof resetAt === 'number' && Number.isFinite(resetAt)
        ? resetAt * 1000
        : null,
    ratio,
    exhausted: ratio >= OPERATING_WARN_RATIO,
  }
}

/**
 * Até quando pausar o método.
 *
 * Prefere o `operating_reset_at` da própria resposta: é o Bitrix dizendo quando a
 * cesta mais velha sai da conta. Sem ele, um minuto — o tamanho de uma cesta — porque
 * chutar mais alto congelaria o método sem motivo e chutar menos voltaria no 429.
 */
export function pauseUntilMs(
  reading: Pick<OperatingReading, 'resetAtMs'> | null,
  nowMs: number,
  fallbackMs = 60_000,
): number {
  const resetAtMs = reading?.resetAtMs
  if (resetAtMs && resetAtMs > nowMs) return resetAtMs

  return nowMs + fallbackMs
}
