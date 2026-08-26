/**
 * Janela de atendimento do agente.
 *
 * Regra **nossa**, aplicada antes de acionar o agente: não existe no vendor.
 */
export type Worktime = {
  /** Liga a regra. `false` = agente disponível em qualquer horário. */
  enabled: boolean
  /** `HH:mm`. */
  initHour: string | null
  /** `HH:mm`. */
  endHour: string | null
  /** Dias da semana ativos, 0 (domingo) a 6 (sábado). */
  activeDays: number[]
  /**
   * Identificador IANA, ex: `America/Sao_Paulo`.
   *
   * **Não** é offset. O HubThink guardava `-03:00_...`, separava com
   * `split('_')` e somava horas na mão — o que erra durante o horário de verão
   * e em qualquer mudança de regra de fuso.
   */
  timezone: string | null
  /**
   * Inverte a janela: `true` = o agente atende **fora** do expediente e
   * silencia dentro dele.
   *
   * Era `activeOfHours` no HubThink, cujo nome dizia o oposto do que o código
   * fazia (`if (isInWorkingHours && activeOfHours) return false`).
   */
  respondsOnlyOffHours: boolean
}

/** Fuso usado quando o agente não tem um configurado. */
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo'

export const DEFAULT_WORKTIME: Worktime = {
  enabled: false,
  initHour: null,
  endHour: null,
  activeDays: [],
  timezone: null,
  respondsOnlyOffHours: false,
}

/** `HH:mm` → minutos desde a meia-noite. `null` quando malformado. */
function toMinutes(hour: string | null): number | null {
  if (!hour) return null

  const match = /^(\d{1,2}):(\d{2})$/.exec(hour)
  if (!match) return null

  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null

  return h * 60 + m
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/**
 * O dia da semana e o minuto do dia **no fuso do agente**.
 *
 * Feito com `Intl`, e não com aritmética de offset, porque é o que conhece as
 * regras de horário de verão de cada zona — inclusive as que mudaram ao longo
 * dos anos.
 */
function localParts(
  at: Date,
  timezone: string,
): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at)

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''

  // `hour12: false` rende 24h, mas algumas implementações devolvem "24" para a
  // meia-noite em vez de "00".
  const hour = Number(get('hour')) % 24

  return {
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
    minutes: hour * 60 + Number(get('minute')),
  }
}

/**
 * O agente está dentro da janela configurada, no fuso dele?
 *
 * O dia da semana é avaliado no **dia local corrente**, e o horário envolve a
 * meia-noite quando `endHour` é menor que `initHour`. Numa janela 22:00–02:00,
 * portanto, 01:00 de terça é avaliado contra terça em `activeDays` — não
 * contra a segunda em que a janela começou. É a regra mais simples que se
 * consegue explicar a quem configura a tela.
 */
function isWithinWindow(worktime: Worktime, at: Date): boolean {
  const start = toMinutes(worktime.initHour)
  const end = toMinutes(worktime.endHour)

  // Janela incompleta ou malformada não delimita nada.
  if (start === null || end === null) return false

  const { weekday, minutes } = localParts(
    at,
    worktime.timezone ?? DEFAULT_TIMEZONE,
  )

  if (!worktime.activeDays.includes(weekday)) return false

  return end < start
    ? minutes >= start || minutes <= end // envolve a meia-noite
    : minutes >= start && minutes <= end
}

/**
 * O agente pode atender neste instante?
 *
 * **Diferença deliberada em relação ao HubThink.** Lá, a única forma de o
 * agente ficar indisponível era `activeOfHours` ligado *dentro* do expediente
 * (`message-helpers.ts`): com a flag desligada, ligar o horário de atendimento
 * não tinha efeito nenhum — fora da janela a função retornava `true` do mesmo
 * jeito. Aqui `enabled` faz o que o nome promete: fora da janela o agente não
 * atende.
 */
export function isAgentAvailableAt(worktime: Worktime, at: Date): boolean {
  if (!worktime.enabled) return true

  const inWindow = isWithinWindow(worktime, at)

  return worktime.respondsOnlyOffHours ? !inWindow : inWindow
}
