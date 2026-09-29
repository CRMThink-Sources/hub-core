import type { LineSettingsToggles } from '@/app/hooks/use-line-api'

/** Toggles editáveis na aba de ajustes, na ordem em que aparecem. */
export const TOGGLE_KEYS = [
  'prefixOperatorNameEnabled',
  'widgetOpenChannelEnabled',
] as const

export type AjustesEditaveis = {
  name: string
  settings: LineSettingsToggles
}

/**
 * Quantos campos da aba diferem do que está gravado.
 *
 * Um por campo, não por tecla: é o que a barra de salvamento mostra ("2 alterações"),
 * e o que decide se há algo a salvar.
 *
 * O nome compara com `trim()` porque é assim que ele é gravado — espaço acidental
 * nas pontas não muda nada no provider, e contá-lo pediria um salvamento vazio.
 */
export function contarAlteracoes(
  inicial: AjustesEditaveis,
  atual: AjustesEditaveis,
): number {
  const nome = atual.name.trim() !== inicial.name.trim() ? 1 : 0
  const toggles = TOGGLE_KEYS.filter(
    key => atual.settings[key] !== inicial.settings[key],
  ).length

  return nome + toggles
}
