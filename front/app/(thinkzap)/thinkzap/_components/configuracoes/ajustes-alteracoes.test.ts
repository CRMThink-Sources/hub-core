import { describe, expect, it } from 'vitest'
import { contarAlteracoes, type AjustesEditaveis } from './ajustes-alteracoes'

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
