/**
 * Regras puras do limite diário de envio por linha.
 *
 * Como `connector-trial.ts`, nada aqui toca Redis ou Bitrix: a contagem vem do
 * adapter, a configuração vem do settings da linha, e a aritmética fica aqui para
 * que tela e caminho de envio leiam o mesmo número.
 */

/** O que o caminho de envio precisa saber para reservar. `null` = linha sem cota. */
export type DailyLimitPolicy = {
  /** Id da instância Z-API — a chave do contador. */
  lineKey: string
  enabled: boolean
  /** Ignorado com `enabled: false`. */
  limit: number
}

export type DailyLimitUsageInput = {
  enabled: boolean
  limit: number | null
  sent: number
  extra: number
}

export type DailyLimitUsage = {
  enabled: boolean
  limit: number | null
  sentToday: number
  extraToday: number
  /** `limit + extra`. `null` com o limite desligado ou nunca configurado. */
  effectiveLimit: number | null
  /** Percentual que falta até o limite efetivo, inteiro e nunca negativo. */
  remainingPercent: number | null
  reached: boolean
}

/** Inteiro > 0: a única forma aceita de limite e de extra. */
export function isValidDailyAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

export function computeDailyLimitUsage(
  input: DailyLimitUsageInput,
): DailyLimitUsage {
  const base = {
    enabled: input.enabled,
    limit: input.limit,
    sentToday: input.sent,
    extraToday: input.extra,
  }

  if (!input.enabled || !isValidDailyAmount(input.limit)) {
    return {
      ...base,
      effectiveLimit: null,
      remainingPercent: null,
      reached: false,
    }
  }

  const effectiveLimit = input.limit + input.extra
  const remaining = Math.max(0, effectiveLimit - input.sent)

  return {
    ...base,
    effectiveLimit,
    remainingPercent: Math.round((remaining / effectiveLimit) * 100),
    reached: input.sent >= effectiveLimit,
  }
}
