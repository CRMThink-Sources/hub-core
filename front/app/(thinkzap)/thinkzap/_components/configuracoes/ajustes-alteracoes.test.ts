import { describe, expect, it } from 'vitest'
import {
  contarAlteracoes,
  limiteDiarioDe,
  limiteDiarioValido,
  patchLimiteDiario,
  type AjustesEditaveis,
} from './ajustes-alteracoes'

const gravado: AjustesEditaveis = {
  name: 'Comercial',
  settings: {
    prefixOperatorNameEnabled: false,
    widgetOpenChannelEnabled: true,
  },
}

const com = (mudancas: {
  name?: string
  settings?: Partial<AjustesEditaveis['settings']>
}): AjustesEditaveis => ({
  name: mudancas.name ?? gravado.name,
  settings: { ...gravado.settings, ...mudancas.settings },
})

describe('contarAlteracoes', () => {
  it('é zero quando nada mudou', () => {
    expect(contarAlteracoes(gravado, com({}))).toBe(0)
  })

  it('conta o nome', () => {
    expect(contarAlteracoes(gravado, com({ name: 'Suporte' }))).toBe(1)
  })

  it('conta um toggle', () => {
    expect(
      contarAlteracoes(
        gravado,
        com({ settings: { prefixOperatorNameEnabled: true } }),
      ),
    ).toBe(1)
  })

  it('conta nome e toggle separadamente', () => {
    expect(
      contarAlteracoes(
        gravado,
        com({
          name: 'Suporte',
          settings: { widgetOpenChannelEnabled: false },
        }),
      ),
    ).toBe(2)
  })

  it('ignora espaço nas pontas do nome, como a gravação', () => {
    expect(contarAlteracoes(gravado, com({ name: '  Comercial ' }))).toBe(0)
  })

  it('volta a zero quando o toggle volta ao valor gravado', () => {
    const marcado = com({ settings: { prefixOperatorNameEnabled: true } })
    const desmarcado = {
      ...marcado,
      settings: { ...marcado.settings, prefixOperatorNameEnabled: false },
    }

    expect(contarAlteracoes(gravado, desmarcado)).toBe(0)
  })
})

describe('limite diário', () => {
  const oficial: AjustesEditaveis = {
    ...gravado,
    limiteDiario: { ativo: false, valor: '' },
  }

  const comLimite = (limiteDiario: AjustesEditaveis['limiteDiario']) => ({
    ...oficial,
    limiteDiario,
  })

  it('ativar e informar 300 contam como 2 alterações', () => {
    expect(
      contarAlteracoes(oficial, comLimite({ ativo: true, valor: '300' })),
    ).toBe(2)
  })

  it('ativar com valor já gravado conta 1', () => {
    const gravadoComValor = comLimite({ ativo: false, valor: '250' })

    expect(
      contarAlteracoes(
        gravadoComValor,
        comLimite({ ativo: true, valor: '250' }),
      ),
    ).toBe(1)
  })

  it('valor mexido com o limite desligado não é pendência', () => {
    expect(
      contarAlteracoes(oficial, comLimite({ ativo: false, valor: '99' })),
    ).toBe(0)
  })

  it('linha sem limite (Z-API) não conta nada do limite', () => {
    expect(contarAlteracoes(gravado, com({}))).toBe(0)
  })

  it.each([
    [{ ativo: true, valor: '' }, false],
    [{ ativo: true, valor: '0' }, false],
    [{ ativo: true, valor: '2.5' }, false],
    [{ ativo: true, valor: '-3' }, false],
    [{ ativo: true, valor: ' 300 ' }, true],
    [{ ativo: false, valor: '' }, true],
    [undefined, true],
  ])('limiteDiarioValido(%j) = %s', (limite, esperado) => {
    expect(limiteDiarioValido(limite)).toBe(esperado)
  })

  it('patch leva só o que mudou', () => {
    expect(
      patchLimiteDiario(oficial, comLimite({ ativo: true, valor: '300' })),
    ).toEqual({ dailyLimitEnabled: true, dailyLimit: 300 })

    const ligado = comLimite({ ativo: true, valor: '300' })
    expect(
      patchLimiteDiario(ligado, comLimite({ ativo: false, valor: '300' })),
    ).toEqual({
      dailyLimitEnabled: false,
    })
    expect(
      patchLimiteDiario(ligado, comLimite({ ativo: true, valor: '500' })),
    ).toEqual({
      dailyLimit: 500,
    })
  })

  it('limiteDiarioDe converte o gravado para o input', () => {
    expect(
      limiteDiarioDe({ dailyLimitEnabled: true, dailyLimit: 300 }),
    ).toEqual({
      ativo: true,
      valor: '300',
    })
    expect(
      limiteDiarioDe({ dailyLimitEnabled: false, dailyLimit: null }),
    ).toEqual({
      ativo: false,
      valor: '',
    })
  })
})
