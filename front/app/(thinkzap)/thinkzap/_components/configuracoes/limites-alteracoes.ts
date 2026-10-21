import type { LineSettingsToggles } from '@/app/hooks/use-line-api'

/**
 * Limite diário como a tela o edita. O valor é o texto do input, e não número: campo
 * vazio é um estado legítimo da edição (e inválido para salvar com o limite ligado).
 */
export type LimiteDiarioEditavel = {
  ativo: boolean
  valor: string
}

/** Cadência como a tela a edita: N, D e P como texto do input, pelo mesmo motivo. */
export type CadenciaEditavel = {
  ativo: boolean
  mensagens: string
  janela: string
  pausaAtiva: boolean
  pausa: string
  /** Contar as mensagens enviadas pelo aparelho na janela. */
  contarAparelho: boolean
}

/** Os dois cards da aba Limites de envio. */
export type LimitesEditaveis = {
  limiteDiario: LimiteDiarioEditavel
  cadencia: CadenciaEditavel
}

const texto = (valor: number | null): string =>
  valor === null ? '' : String(valor)

/** O que está gravado, no formato do input. */
export function limiteDiarioDe(
  settings: Pick<LineSettingsToggles, 'dailyLimitEnabled' | 'dailyLimit'>,
): LimiteDiarioEditavel {
  return {
    ativo: settings.dailyLimitEnabled,
    valor: texto(settings.dailyLimit),
  }
}

/** Defensivo: api anterior à cadência não manda os campos. */
export function cadenciaDe(
  settings: Partial<
    Pick<
      LineSettingsToggles,
      | 'cadenceEnabled'
      | 'cadenceMaxMessages'
      | 'cadenceWindowMinutes'
      | 'cadencePauseEnabled'
      | 'cadencePauseMinutes'
      | 'cadenceCountDeviceMessages'
    >
  >,
): CadenciaEditavel {
  return {
    ativo: settings.cadenceEnabled === true,
    mensagens: texto(settings.cadenceMaxMessages ?? null),
    janela: texto(settings.cadenceWindowMinutes ?? null),
    pausaAtiva: settings.cadencePauseEnabled === true,
    pausa: texto(settings.cadencePauseMinutes ?? null),
    contarAparelho: settings.cadenceCountDeviceMessages === true,
  }
}

/** Inteiro > 0 escrito como texto — a única forma que a api aceita. */
export function inteiroPositivo(valor: string): boolean {
  const limpo = valor.trim()
  return /^\d+$/.test(limpo) && Number(limpo) > 0
}

/** Desligado, qualquer valor serve — ele não vai. */
export function limiteDiarioValido(limite?: LimiteDiarioEditavel): boolean {
  if (!limite || !limite.ativo) return true
  return inteiroPositivo(limite.valor)
}

/** Campos da cadência inválidos, para o card marcar cada um. */
export function camposInvalidosCadencia(cadencia: CadenciaEditavel): {
  mensagens: boolean
  janela: boolean
  pausa: boolean
} {
  if (!cadencia.ativo) return { mensagens: false, janela: false, pausa: false }
  return {
    mensagens: !inteiroPositivo(cadencia.mensagens),
    janela: !inteiroPositivo(cadencia.janela),
    pausa: cadencia.pausaAtiva && !inteiroPositivo(cadencia.pausa),
  }
}

export function cadenciaValida(cadencia: CadenciaEditavel): boolean {
  const invalidos = camposInvalidosCadencia(cadencia)
  return !invalidos.mensagens && !invalidos.janela && !invalidos.pausa
}

const mudou = (antes: string, agora: string) => antes.trim() !== agora.trim()

/**
 * Quantos campos da aba diferem do que está gravado — um por campo, como a barra de
 * salvamento mostra.
 *
 * Valor de recurso desligado não conta: o campo fica travado e não é enviado, então
 * mexer nele antes de desligar não é pendência. O mesmo vale para P com a pausa
 * desligada.
 */
export function contarAlteracoesLimites(
  inicial: LimitesEditaveis,
  atual: LimitesEditaveis,
): number {
  const ld = atual.limiteDiario
  const ldAntes = inicial.limiteDiario
  const limite =
    (ld.ativo !== ldAntes.ativo ? 1 : 0) +
    (ld.ativo && mudou(ldAntes.valor, ld.valor) ? 1 : 0)

  const c = atual.cadencia
  const cAntes = inicial.cadencia
  const cadencia =
    (c.ativo !== cAntes.ativo ? 1 : 0) +
    (c.ativo && mudou(cAntes.mensagens, c.mensagens) ? 1 : 0) +
    (c.ativo && mudou(cAntes.janela, c.janela) ? 1 : 0) +
    (c.ativo && c.pausaAtiva !== cAntes.pausaAtiva ? 1 : 0) +
    (c.ativo && c.pausaAtiva && mudou(cAntes.pausa, c.pausa) ? 1 : 0) +
    (c.ativo && c.contarAparelho !== cAntes.contarAparelho ? 1 : 0)

  return limite + cadencia
}

/** Só o que mudou vai no payload — o mesmo critério da contagem. */
export function patchLimites(
  inicial: LimitesEditaveis,
  atual: LimitesEditaveis,
): Partial<LineSettingsToggles> {
  const ld = atual.limiteDiario
  const ldAntes = inicial.limiteDiario
  const c = atual.cadencia
  const cAntes = inicial.cadencia
  const n = (valor: string) => Number(valor.trim())

  return {
    ...(ld.ativo !== ldAntes.ativo && { dailyLimitEnabled: ld.ativo }),
    ...(ld.ativo &&
      mudou(ldAntes.valor, ld.valor) && { dailyLimit: n(ld.valor) }),
    ...(c.ativo !== cAntes.ativo && { cadenceEnabled: c.ativo }),
    ...(c.ativo &&
      mudou(cAntes.mensagens, c.mensagens) && {
        cadenceMaxMessages: n(c.mensagens),
      }),
    ...(c.ativo &&
      mudou(cAntes.janela, c.janela) && {
        cadenceWindowMinutes: n(c.janela),
      }),
    ...(c.ativo &&
      c.pausaAtiva !== cAntes.pausaAtiva && {
        cadencePauseEnabled: c.pausaAtiva,
      }),
    ...(c.ativo &&
      c.pausaAtiva &&
      mudou(cAntes.pausa, c.pausa) && { cadencePauseMinutes: n(c.pausa) }),
    ...(c.ativo &&
      c.contarAparelho !== cAntes.contarAparelho && {
        cadenceCountDeviceMessages: c.contarAparelho,
      }),
  }
}
