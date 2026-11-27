import axios from 'axios'
import { BitrixMethodPausedError } from './bitrix-limits.port'

/**
 * Os dois limites do Bitrix, reconhecidos pelo que a resposta diz.
 *
 * Tratá-los igual seria errado: `QUERY_LIMIT_EXCEEDED` é intensidade e passa em
 * milissegundos; `OPERATION_TIME_LIMIT` é tempo de execução acumulado por método, e
 * insistir nele não resolve — só o balde de minutos vencendo resolve.
 */

export type BitrixLimitKind = 'query-limit' | 'operation-time'

export type BitrixLimitHit = {
  kind: BitrixLimitKind
  status: number
  code: string
}

const LIMIT_CODES: Record<string, BitrixLimitKind> = {
  QUERY_LIMIT_EXCEEDED: 'query-limit',
  OPERATION_TIME_LIMIT: 'operation-time',
}

/**
 * `null` = não é limite.
 *
 * Casa por **código**, não por status: o 503 e o 429 estão documentados, mas o código
 * é o que identifica qual limite bateu, e infra no meio do caminho pode trocar o
 * status sem mexer no corpo.
 */
export function classifyLimitError(error: unknown): BitrixLimitHit | null {
  const response = axios.isAxiosError(error) ? error.response : undefined
  const body = (response?.data ?? {}) as { error?: unknown }
  const code = typeof body.error === 'string' ? body.error.toUpperCase() : ''

  const kind = LIMIT_CODES[code]
  if (kind) return { kind, status: response?.status ?? 0, code }

  /**
   * Fallback por status: 503 sem corpo legível é, na prática, o bloqueio de
   * intensidade. Tratar como limite faz a gente recuar; tratar como erro comum faria
   * o BullMQ retentar na hora, em cima do limite.
   */
  if (response?.status === 503) {
    return { kind: 'query-limit', status: 503, code: code || 'HTTP_503' }
  }

  return null
}

export type BackoffOptions = {
  baseMs?: number
  maxMs?: number
  /** Fração do atraso sorteada. `0` desliga o jitter — só para teste. */
  jitterRatio?: number
  random?: () => number
}

/**
 * Espera exponencial com jitter.
 *
 * O jitter não é enfeite: o limite é **por portal**, então vários workers que
 * levaram 503 na mesma janela voltariam juntos e estourariam de novo. Espalhar é o
 * que quebra o sincronismo.
 */
export function retryDelayMs(
  attempt: number,
  options: BackoffOptions = {},
): number {
  const {
    baseMs = 500,
    maxMs = 15_000,
    jitterRatio = 0.5,
    random = Math.random,
  } = options

  const exponential = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1))
  const jitter = exponential * jitterRatio * random()

  return Math.round(exponential - exponential * jitterRatio + jitter)
}

export const MAX_QUERY_LIMIT_RETRIES = 4

/**
 * Quanto esperar para refazer a chamada que o Bitrix recusou por intensidade mesmo
 * depois das retentativas do interceptor: o balde do portal leva segundos para
 * esvaziar, e voltar antes disso só bateria no limite de novo.
 */
export const QUERY_LIMIT_DEFER_MS = 60_000

/** Código de limite no corpo que o `BitrixClient` serializa na mensagem do erro. */
const LIMIT_CODE_IN_MESSAGE =
  /"error"\s*:\s*"(?:QUERY_LIMIT_EXCEEDED|OPERATION_TIME_LIMIT)"/i

/**
 * Até quando adiar uma chamada que o Bitrix **com certeza não executou**, ou `null`
 * quando o erro não garante isso.
 *
 * Só entram a pausa local (lançada antes de a requisição sair) e a recusa por limite,
 * que o Bitrix devolve sem executar o método. Timeout, rede e 503 sem código ficam de
 * fora: a chamada pode ter gravado, e para método que não é idempotente repetir
 * duplicaria.
 */
export function bitrixRefusedUntil(
  error: unknown,
  nowMs: number,
): number | null {
  if (error instanceof BitrixMethodPausedError) {
    return Math.max(error.untilMs, nowMs)
  }

  const hit = classifyLimitError(error)
  const refusedByCode = hit !== null && hit.code in LIMIT_CODES
  const refusedInMessage =
    error instanceof Error && LIMIT_CODE_IN_MESSAGE.test(error.message)

  return refusedByCode || refusedInMessage ? nowMs + QUERY_LIMIT_DEFER_MS : null
}
