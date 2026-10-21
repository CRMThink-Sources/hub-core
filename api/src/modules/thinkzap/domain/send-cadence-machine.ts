/**
 * A máquina de estados da cadência, em TypeScript puro.
 *
 * É a **especificação executável** dos scripts Lua de `redis-send-cadence.ts`: cada
 * passo aqui tem o passo correspondente lá, na mesma ordem. Os testes do adapter
 * usam esta função como o "Redis" do fake, como `redis-daily-send-quota.test.ts`
 * faz com a reserva diária — o Redis roda um script por vez, e aqui cada chamada é
 * síncrona, o que dá a mesma atomicidade.
 *
 * Mudou uma regra? Mude aqui **e** no Lua.
 */

/** Estado persistido por linha. `0` = ausente. Horários em epoch ms. */
export type CadenceMachineState = {
  /** Início da janela vigente (também é o id dela). */
  windowId: number
  /** Fim da janela; `windowEnd <= now` = sem janela aberta. */
  windowEnd: number
  count: number
  pauseUntil: number
  /** Snapshot da configuração com que a janela abriu. */
  snapN: number
  snapD: number
  snapP: number
}

export const EMPTY_CADENCE_STATE: CadenceMachineState = {
  windowId: 0,
  windowEnd: 0,
  count: 0,
  pauseUntil: 0,
  snapN: 0,
  snapD: 0,
  snapP: 0,
}

export type CadenceMachineConfig = {
  enabled: boolean
  maxMessages: number
  windowMs: number
  pauseMs: number
}

export type CadenceReserveOutcome =
  | { allowed: true; windowId: number }
  | {
      allowed: false
      retryAt: number
      reason: 'paused' | 'window-full' | 'not-head'
    }

/** Conta um envio na janela aberta; ao chegar em N com pausa, a pausa substitui o resto. */
function countInOpenWindow(
  state: CadenceMachineState,
  now: number,
): CadenceMachineState {
  const count = state.count + 1
  if (count >= state.snapN && state.snapP > 0) {
    return { ...state, count, pauseUntil: now + state.snapP, windowEnd: now }
  }
  return { ...state, count }
}

function openWindow(
  cfg: CadenceMachineConfig,
  now: number,
): CadenceMachineState {
  return countInOpenWindow(
    {
      windowId: now,
      windowEnd: now + cfg.windowMs,
      count: 0,
      pauseUntil: 0,
      snapN: cfg.maxMessages,
      snapD: cfg.windowMs,
      snapP: cfg.pauseMs,
    },
    now,
  )
}

const isPaused = (s: CadenceMachineState, now: number) => s.pauseUntil > now
const isWindowOpen = (s: CadenceMachineState, now: number) => s.windowEnd > now
const isWindowFull = (s: CadenceMachineState, now: number) =>
  isWindowOpen(s, now) && s.count >= s.snapN

/**
 * Pede vaga para o ticket. `isHead` = o ticket é a cabeça da fila FIFO da linha.
 *
 * Ordem dos passos (igual ao Lua):
 * 1. pausa vigente nega para todos, com o fim da pausa;
 * 2. janela cheia nega para todos, com o fim da janela;
 * 3. quem não é a cabeça espera a vez;
 * 4. janela aberta com vaga conta;
 * 5. sem janela: cadência desligada libera sem contar (e limpa o estado);
 *    ligada abre uma janela nova com o snapshot da configuração atual.
 */
export function reserveStep(
  state: CadenceMachineState,
  cfg: CadenceMachineConfig,
  now: number,
  isHead: boolean,
  notHeadRetryMs: number,
): { state: CadenceMachineState; outcome: CadenceReserveOutcome } {
  if (isPaused(state, now)) {
    return {
      state,
      outcome: { allowed: false, retryAt: state.pauseUntil, reason: 'paused' },
    }
  }
  if (isWindowFull(state, now)) {
    return {
      state,
      outcome: {
        allowed: false,
        retryAt: state.windowEnd,
        reason: 'window-full',
      },
    }
  }
  if (!isHead) {
    return {
      state,
      outcome: {
        allowed: false,
        retryAt: now + notHeadRetryMs,
        reason: 'not-head',
      },
    }
  }
  if (isWindowOpen(state, now)) {
    const next = countInOpenWindow(state, now)
    return { state: next, outcome: { allowed: true, windowId: next.windowId } }
  }
  if (!cfg.enabled) {
    return {
      state: { ...EMPTY_CADENCE_STATE },
      outcome: { allowed: true, windowId: 0 },
    }
  }
  const next = openWindow(cfg, now)
  return { state: next, outcome: { allowed: true, windowId: next.windowId } }
}

/**
 * Envio que já aconteceu fora da fila (mensagem espelhada do aparelho): conta, mas
 * nunca nega — durante a pausa ou com a janela cheia, não faz nada (não estende a
 * pausa nem antecipa a janela).
 */
export function registerExternalStep(
  state: CadenceMachineState,
  cfg: CadenceMachineConfig,
  now: number,
): CadenceMachineState {
  if (isPaused(state, now) || isWindowFull(state, now)) return state
  if (isWindowOpen(state, now)) return countInOpenWindow(state, now)
  if (!cfg.enabled) return state
  return openWindow(cfg, now)
}

/**
 * Devolve a vaga de um envio que o provider recusou, só se a janela ainda é a mesma
 * que a concedeu. Uma pausa já disparada por essa vaga **fica**: o risco é segurar a
 * linha um pouco a mais, nunca deixar passar volume.
 */
export function releaseStep(
  state: CadenceMachineState,
  windowId: number,
): CadenceMachineState {
  if (windowId === 0 || state.windowId !== windowId || state.count <= 0) {
    return state
  }
  return { ...state, count: state.count - 1 }
}
