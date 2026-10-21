/**
 * Regras puras da cadência de envio por linha.
 *
 * Como `daily-send-limit.ts`, nada aqui toca Redis: o estado da janela vem do
 * adapter, a configuração vem do settings da linha. Aqui ficam a validação e a
 * tradução settings → política, para que PATCH, tela e caminho de envio leiam a
 * mesma regra.
 */
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import type { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'

export type CadenceSettings = Pick<
  ConnectorSettings,
  | 'cadenceEnabled'
  | 'cadenceMaxMessages'
  | 'cadenceWindowMinutes'
  | 'cadencePauseEnabled'
  | 'cadencePauseMinutes'
>

/**
 * O que o caminho de envio precisa saber para pedir vaga. `null` = linha sem
 * cadência (oficial), e o envio segue sem tocar no Redis.
 *
 * Com `enabled: false` a política **continua existindo** na linha Z-API: a janela
 * ou pausa aberta com a cadência ligada termina com o snapshot dela, e o FIFO por
 * linha vale com a cadência desligada.
 */
export type CadencePolicy = {
  /** Id da instância Z-API — a mesma chave da cota diária. */
  lineKey: string
  enabled: boolean
  /** N. Ignorado com `enabled: false`. */
  maxMessages: number
  /** D em ms. */
  windowMs: number
  /** P em ms; `0` = sem pausa. */
  pauseMs: number
}

export type CadencePhase = 'idle' | 'window' | 'paused'

/** Estado lido do Redis para a tela. Horários em epoch ms. */
export type CadenceState = {
  phase: CadencePhase
  /** Envios da janela aberta (0 fora de janela). */
  count: number
  /** N do snapshot da janela aberta; `null` sem janela. */
  max: number | null
  windowEndsAt: number | null
  pauseUntil: number | null
  /** Snapshot com que a janela ou a pausa vigente abriu; `null` em `idle`. */
  snapshot: {
    maxMessages: number
    windowMs: number
    pauseMs: number
  } | null
}

const MINUTE_MS = 60_000

/** Inteiro >= 1: a única forma aceita de N, D e P. */
export function isValidCadenceAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

/**
 * A configuração gravável. Com a cadência desligada, nada é exigido; com a pausa
 * desligada, P não é exigido.
 */
export function isValidCadenceConfig(settings: CadenceSettings): boolean {
  if (!settings.cadenceEnabled) return true
  if (!isValidCadenceAmount(settings.cadenceMaxMessages)) return false
  if (!isValidCadenceAmount(settings.cadenceWindowMinutes)) return false
  if (
    settings.cadencePauseEnabled &&
    !isValidCadenceAmount(settings.cadencePauseMinutes)
  ) {
    return false
  }
  return true
}

export type CadencePolicyInput = {
  provider: ConnectorProvider
  lineKey?: string | null
  settings?: CadenceSettings | null
}

/**
 * Só a linha não oficial: é ela que o WhatsApp bloqueia por rajada. Configuração
 * ligada mas inválida (gravada à mão na SPA) conta como desligada — o PATCH nunca
 * deixa gravar assim, e travar a linha por um valor ilegível seria pior.
 */
export function cadencePolicyOf(
  input: CadencePolicyInput,
): CadencePolicy | null {
  if (input.provider !== ConnectorProvider.ZAPI) return null
  if (!input.lineKey) return null

  const s = input.settings
  const enabled = s?.cadenceEnabled === true && isValidCadenceConfig(s)
  if (!enabled || !s) {
    return {
      lineKey: input.lineKey,
      enabled: false,
      maxMessages: 0,
      windowMs: 0,
      pauseMs: 0,
    }
  }

  return {
    lineKey: input.lineKey,
    enabled: true,
    maxMessages: s.cadenceMaxMessages as number,
    windowMs: (s.cadenceWindowMinutes as number) * MINUTE_MS,
    pauseMs: s.cadencePauseEnabled
      ? (s.cadencePauseMinutes as number) * MINUTE_MS
      : 0,
  }
}

/**
 * Se a configuração gravada difere do snapshot da janela/pausa vigente — a tela
 * avisa que os novos valores entram na próxima janela.
 */
export function hasPendingCadenceChange(
  policy: CadencePolicy,
  state: CadenceState,
): boolean {
  if (!state.snapshot) return false
  if (!policy.enabled) return true
  return (
    state.snapshot.maxMessages !== policy.maxMessages ||
    state.snapshot.windowMs !== policy.windowMs ||
    state.snapshot.pauseMs !== policy.pauseMs
  )
}
