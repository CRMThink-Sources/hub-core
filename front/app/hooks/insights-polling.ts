/**
 * Consulta periódica dos painéis do Insights. A API não espera o cálculo: sem
 * resultado guardado ela responde `202 { status: 'computing' }` e a tela repete
 * a consulta até receber o painel (ou um erro). Fica separado do hook para ser
 * testado sem React.
 */

/** Intervalo entre consultas enquanto o painel está sendo calculado. */
export const COMPUTING_POLL_MS = 3000
/** Intervalo enquanto se espera o recálculo de um painel já exibido (desatualizado). */
export const STALE_REFRESH_POLL_MS = 5000
/**
 * Quanto a tela espera no total. Um pouco acima do prazo máximo do servidor
 * (15 min): a API devolve o erro antes de a tela desistir por conta própria.
 */
export const MAX_WAIT_MS = 16 * 60_000

export type ComputingBody = { status: 'computing'; startedAt?: number }

export function isComputing(value: unknown): value is ComputingBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { status?: unknown }).status === 'computing'
  )
}

/** A tela esperou o cálculo além do prazo e desistiu. */
export class InsightsWaitTimeoutError extends Error {
  constructor() {
    super('O cálculo do painel do Insights passou do prazo de espera.')
    this.name = 'InsightsWaitTimeoutError'
  }
}

type Clock = {
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

const defaultSleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Repete `get` enquanto a API responde "calculando". Devolve o painel, ou
 * `null` se a espera foi cancelada (o filtro mudou: a resposta atrasada não
 * pode sobrescrever a mais nova). Erro de `get` sobe como está.
 */
export async function pollUntilReady<T>(
  get: () => Promise<T | ComputingBody>,
  opts: {
    isCancelled: () => boolean
    onComputing?: () => void
  } & Clock,
): Promise<T | null> {
  const sleep = opts.sleep ?? defaultSleep
  const now = opts.now ?? Date.now
  const startedAt = now()
  for (;;) {
    const result = await get()
    if (opts.isCancelled()) return null
    if (!isComputing(result)) return result
    opts.onComputing?.()
    if (now() - startedAt >= MAX_WAIT_MS) throw new InsightsWaitTimeoutError()
    await sleep(COMPUTING_POLL_MS)
    if (opts.isCancelled()) return null
  }
}

/**
 * Painel desatualizado (`stale: true`) já está na tela; a API recalcula em
 * segundo plano. Consulta de novo até chegar a versão nova e a entrega em
 * `onData`. Qualquer erro encerra em silêncio: o painel antigo continua
 * exibido e a próxima abertura tenta de novo.
 */
export async function refreshWhileStale<T extends { stale?: boolean }>(
  get: () => Promise<T | ComputingBody>,
  first: T,
  opts: {
    isCancelled: () => boolean
    onData: (fresh: T) => void
  } & Clock,
): Promise<void> {
  if (!first.stale) return
  const sleep = opts.sleep ?? defaultSleep
  const now = opts.now ?? Date.now
  const startedAt = now()
  while (now() - startedAt < MAX_WAIT_MS) {
    await sleep(STALE_REFRESH_POLL_MS)
    if (opts.isCancelled()) return
    let next: T | ComputingBody
    try {
      next = await get()
    } catch {
      return
    }
    if (opts.isCancelled()) return
    if (isComputing(next)) continue
    if (!next.stale) {
      opts.onData(next)
      return
    }
  }
}
