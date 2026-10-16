import type { LineSettingsToggles } from '@/app/hooks/use-line-api'

/** Toggles editáveis na aba de ajustes, na ordem em que aparecem. */
export const TOGGLE_KEYS = [
  'prefixOperatorNameEnabled',
  'widgetOpenChannelEnabled',
] as const

export type ToggleKey = (typeof TOGGLE_KEYS)[number]

/**
 * Limite diário como a tela o edita. O valor é o texto do input, e não número: campo
 * vazio é um estado legítimo da edição (e inválido para salvar com o limite ligado).
 */
export type LimiteDiarioEditavel = {
  ativo: boolean
  valor: string
}

export type AjustesEditaveis = {
  name: string
  settings: Pick<LineSettingsToggles, ToggleKey>
  /** Só na linha não oficial. Ausente, o limite não entra na contagem nem no payload. */
  limiteDiario?: LimiteDiarioEditavel
}

/** O que está gravado, no formato do input. */
export function limiteDiarioDe(
  settings: Pick<LineSettingsToggles, 'dailyLimitEnabled' | 'dailyLimit'>,
): LimiteDiarioEditavel {
  return {
    ativo: settings.dailyLimitEnabled,
    valor: settings.dailyLimit === null ? '' : String(settings.dailyLimit),
  }
}

/** Inteiro > 0, como a api exige. Desligado, qualquer valor serve — ele não vai. */
export function limiteDiarioValido(limite?: LimiteDiarioEditavel): boolean {
  if (!limite || !limite.ativo) return true

  const valor = limite.valor.trim()
  return /^\d+$/.test(valor) && Number(valor) > 0
}

/**
 * Quantos campos da aba diferem do que está gravado.
 *
 * Um por campo, não por tecla: é o que a barra de salvamento mostra ("2 alterações"),
 * e o que decide se há algo a salvar.
 *
 * O nome compara com `trim()` porque é assim que ele é gravado — espaço acidental
 * nas pontas não muda nada no provider, e contá-lo pediria um salvamento vazio.
 *
 * O valor do limite só conta com o limite ligado na tela: desligado, o campo fica
 * travado e o valor não é enviado, então mexer nele antes de desligar não é pendência.
 */
export function contarAlteracoes(
  inicial: AjustesEditaveis,
  atual: AjustesEditaveis,
): number {
  const nome = atual.name.trim() !== inicial.name.trim() ? 1 : 0
  const toggles = TOGGLE_KEYS.filter(
    key => atual.settings[key] !== inicial.settings[key],
  ).length

  return nome + toggles + contarAlteracoesLimite(inicial, atual)
}

function contarAlteracoesLimite(
  inicial: AjustesEditaveis,
  atual: AjustesEditaveis,
): number {
  const antes = inicial.limiteDiario
  const agora = atual.limiteDiario
  if (!antes || !agora) return 0

  const ativo = agora.ativo !== antes.ativo ? 1 : 0
  const valor = agora.ativo && agora.valor.trim() !== antes.valor.trim() ? 1 : 0

  return ativo + valor
}

/** Só o que mudou do limite vai no payload — o mesmo critério da contagem. */
export function patchLimiteDiario(
  inicial: AjustesEditaveis,
  atual: AjustesEditaveis,
): Partial<Pick<LineSettingsToggles, 'dailyLimitEnabled' | 'dailyLimit'>> {
  const antes = inicial.limiteDiario
  const agora = atual.limiteDiario
  if (!antes || !agora) return {}

  return {
    ...(agora.ativo !== antes.ativo && { dailyLimitEnabled: agora.ativo }),
    ...(agora.ativo &&
      agora.valor.trim() !== antes.valor.trim() && {
        dailyLimit: Number(agora.valor.trim()),
      }),
  }
}
