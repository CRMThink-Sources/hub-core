/**
 * Navegação do passo a passo simulado. `done` é a tela de conclusão depois do
 * último passo — fica separado de `step` para "Voltar" na conclusão reabrir o
 * último passo em vez de pular um.
 */
export type WalkthroughState = { step: number; done: boolean }

export type WalkthroughAction =
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'goTo'; step: number }
  | { type: 'restart' }

export const INITIAL_WALKTHROUGH: WalkthroughState = { step: 0, done: false }

export function walkthroughReducer(
  total: number,
  state: WalkthroughState,
  action: WalkthroughAction,
): WalkthroughState {
  const last = Math.max(total - 1, 0)

  switch (action.type) {
    case 'next':
      if (state.done) return state
      return state.step >= last
        ? { step: last, done: true }
        : { step: state.step + 1, done: false }
    case 'prev':
      if (state.done) return { step: last, done: false }
      return { step: Math.max(state.step - 1, 0), done: false }
    case 'goTo':
      return {
        step: Math.min(Math.max(Math.trunc(action.step), 0), last),
        done: false,
      }
    case 'restart':
      return INITIAL_WALKTHROUGH
  }
}
