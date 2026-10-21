import { describe, expect, it } from 'vitest'
import {
  cadenciaDe,
  cadenciaValida,
  camposInvalidosCadencia,
  contarAlteracoesLimites,
  limiteDiarioDe,
  limiteDiarioValido,
  patchLimites,
  type CadenciaEditavel,
  type LimitesEditaveis,
} from './limites-alteracoes'

const desligada: CadenciaEditavel = {
  ativo: false,
  mensagens: '',
  janela: '',
  pausaAtiva: false,
  pausa: '',
  contarAparelho: false,
}

const gravado: LimitesEditaveis = {
  limiteDiario: { ativo: false, valor: '' },
  cadencia: desligada,
}

const com = (over: {
  limiteDiario?: Partial<LimitesEditaveis['limiteDiario']>
  cadencia?: Partial<CadenciaEditavel>
}): LimitesEditaveis => ({
  limiteDiario: { ...gravado.limiteDiario, ...over.limiteDiario },
  cadencia: { ...gravado.cadencia, ...over.cadencia },
})

describe('contarAlteracoesLimites', () => {
  it('é zero quando nada mudou', () => {
    expect(contarAlteracoesLimites(gravado, com({}))).toBe(0)
  })

  it('Limite diário conta como alteração: ativar e informar 300 são 2', () => {
    expect(
      contarAlteracoesLimites(
        gravado,
        com({ limiteDiario: { ativo: true, valor: '300' } }),
      ),
    ).toBe(2)
  })

  it('valor do limite mexido com ele desligado não é pendência', () => {
    expect(
      contarAlteracoesLimites(gravado, com({ limiteDiario: { valor: '99' } })),
    ).toBe(0)
  })

  it('Cadência e limite salvos juntos: 2 do limite + 3 da cadência', () => {
    expect(
      contarAlteracoesLimites(
        gravado,
        com({
          limiteDiario: { ativo: true, valor: '300' },
          cadencia: { ativo: true, mensagens: '20', janela: '1' },
        }),
      ),
    ).toBe(5)
  })

  it('P com a pausa desligada não conta', () => {
    expect(
      contarAlteracoesLimites(
        gravado,
        com({ cadencia: { ativo: true, pausa: '5' } }),
      ),
    ).toBe(1)
  })

  it('ligar a pausa com P conta 2', () => {
    const ligada = com({
      cadencia: { ativo: true, mensagens: '20', janela: '1' },
    })
    expect(
      contarAlteracoesLimites(ligada, {
        ...ligada,
        cadencia: { ...ligada.cadencia, pausaAtiva: true, pausa: '5' },
      }),
    ).toBe(2)
  })
})

describe('validação', () => {
  it.each([
    [{ ativo: true, valor: '' }, false],
    [{ ativo: true, valor: '0' }, false],
    [{ ativo: true, valor: '2.5' }, false],
    [{ ativo: true, valor: ' 300 ' }, true],
    [{ ativo: false, valor: '' }, true],
    [undefined, true],
  ])('limiteDiarioValido(%j) = %s', (limite, esperado) => {
    expect(limiteDiarioValido(limite)).toBe(esperado)
  })

  it('Cadência inválida: "mensagens por janela" vazio é marcado', () => {
    const c = { ...desligada, ativo: true, janela: '1' }
    expect(camposInvalidosCadencia(c)).toEqual({
      mensagens: true,
      janela: false,
      pausa: false,
    })
    expect(cadenciaValida(c)).toBe(false)
  })

  it('Valor inválido impede salvar: pausa ativada com a duração vazia', () => {
    const c = {
      ativo: true,
      mensagens: '20',
      janela: '1',
      pausaAtiva: true,
      pausa: '',
      contarAparelho: false,
    }
    expect(camposInvalidosCadencia(c).pausa).toBe(true)
    expect(cadenciaValida(c)).toBe(false)
  })

  it('cadência desligada não valida nada', () => {
    expect(cadenciaValida({ ...desligada, mensagens: '0' })).toBe(true)
  })
})

describe('patchLimites', () => {
  it('leva só o que mudou, com números', () => {
    expect(
      patchLimites(
        gravado,
        com({
          limiteDiario: { ativo: true, valor: '300' },
          cadencia: {
            ativo: true,
            mensagens: '20',
            janela: '1',
            pausaAtiva: true,
            pausa: ' 5 ',
          },
        }),
      ),
    ).toEqual({
      dailyLimitEnabled: true,
      dailyLimit: 300,
      cadenceEnabled: true,
      cadenceMaxMessages: 20,
      cadenceWindowMinutes: 1,
      cadencePauseEnabled: true,
      cadencePauseMinutes: 5,
    })
  })

  it('desligar a cadência manda só o toggle', () => {
    const ligada = com({
      cadencia: { ativo: true, mensagens: '20', janela: '1' },
    })
    expect(
      patchLimites(ligada, {
        ...ligada,
        cadencia: { ...ligada.cadencia, ativo: false },
      }),
    ).toEqual({ cadenceEnabled: false })
  })
})

describe('conversão do gravado', () => {
  it('limiteDiarioDe', () => {
    expect(
      limiteDiarioDe({ dailyLimitEnabled: true, dailyLimit: 300 }),
    ).toEqual({
      ativo: true,
      valor: '300',
    })
  })

  it('cadenciaDe tolera api sem os campos', () => {
    expect(cadenciaDe({})).toEqual(desligada)
    expect(
      cadenciaDe({
        cadenceEnabled: true,
        cadenceMaxMessages: 20,
        cadenceWindowMinutes: 1,
        cadencePauseEnabled: false,
        cadencePauseMinutes: null,
      }),
    ).toEqual({
      ativo: true,
      mensagens: '20',
      janela: '1',
      pausaAtiva: false,
      pausa: '',
      contarAparelho: false,
    })
  })
})

describe('contar mensagens do aparelho', () => {
  const ligada = com({
    cadencia: { ativo: true, mensagens: '20', janela: '1' },
  })

  it('ligar a opção conta 1 e vai no payload', () => {
    const atual = {
      ...ligada,
      cadencia: { ...ligada.cadencia, contarAparelho: true },
    }
    expect(contarAlteracoesLimites(ligada, atual)).toBe(1)
    expect(patchLimites(ligada, atual)).toEqual({
      cadenceCountDeviceMessages: true,
    })
  })

  it('cadenciaDe lê a opção, desligada por padrão', () => {
    expect(cadenciaDe({}).contarAparelho).toBe(false)
    expect(
      cadenciaDe({ cadenceCountDeviceMessages: true }).contarAparelho,
    ).toBe(true)
  })
})
