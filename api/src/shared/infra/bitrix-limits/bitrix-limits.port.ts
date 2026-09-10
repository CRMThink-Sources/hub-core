/**
 * Contrato do controle de limites, e o padrão que não faz nada.
 *
 * O `noop` é o default de propósito: o cliente Bitrix é construído em dezenas de
 * lugares, inclusive em teste unitário com axios mockado, e nenhum deles pode passar
 * a exigir Redis. O bootstrap instala a implementação real; sem ela o app funciona
 * como antes.
 */

export type BitrixLimitsContext = {
  /** Portal. O balde de intensidade é por portal. */
  domain: string
  method: string
}

export interface BitrixLimits {
  /**
   * Reserva espaço no balde do portal. Resolve depois de esperar, se precisar.
   *
   * Não lança por limite: esperar é o comportamento desejado no caminho de mensagem.
   */
  acquire(context: BitrixLimitsContext): Promise<void>

  /** `null` = liberado. Preenchido = método pausado até esse instante (ms epoch). */
  pausedUntil(context: BitrixLimitsContext): Promise<number | null>

  /** Registra o `operating` observado na resposta, para desviar antes do 429. */
  observeOperating(
    context: BitrixLimitsContext,
    operatingSeconds: number,
    resetAtMs: number | null,
  ): Promise<void>

  /** Pausa o método até `untilMs` — chamado quando o 429 chega mesmo assim. */
  pauseMethod(context: BitrixLimitsContext, untilMs: number): Promise<void>
}

export const noopBitrixLimits: BitrixLimits = {
  acquire: () => Promise.resolve(),
  pausedUntil: () => Promise.resolve(null),
  observeOperating: () => Promise.resolve(),
  pauseMethod: () => Promise.resolve(),
}

let current: BitrixLimits = noopBitrixLimits

export function setBitrixLimits(limits: BitrixLimits): void {
  current = limits
}

export function getBitrixLimits(): BitrixLimits {
  return current
}

/** @internal vitest only */
export function resetBitrixLimitsForTests(): void {
  current = noopBitrixLimits
}

/** Método pausado por orçamento de execução esgotado. */
export class BitrixMethodPausedError extends Error {
  constructor(
    readonly method: string,
    readonly domain: string,
    readonly untilMs: number,
  ) {
    super(
      `Bitrix ${method}: método pausado no portal ${domain} até ${new Date(untilMs).toISOString()} (OPERATION_TIME_LIMIT)`,
    )
    this.name = 'BitrixMethodPausedError'
  }
}
