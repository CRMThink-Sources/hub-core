import { describe, expect, it } from 'vitest'
import { resolveTemplateBody } from './resolve-template-body'

describe('resolveTemplateBody', () => {
  it('substitui placeholders posicionais na ordem de aparição', () => {
    expect(
      resolveTemplateBody('Olá {{1}}, pedido {{2}} saiu.', ['Maria', '1234']),
    ).toBe('Olá Maria, pedido 1234 saiu.')
  })

  it('substitui placeholders nomeados', () => {
    expect(
      resolveTemplateBody('Olá {{nome}}, seu código é {{codigo}}.', [
        'Maria',
        'X1',
      ]),
    ).toBe('Olá Maria, seu código é X1.')
  })

  it('nome repetido consome um único parâmetro', () => {
    expect(
      resolveTemplateBody('Olá {{nome}}, tudo bem {{nome}}? Pedido {{2}}.', [
        'Maria',
        '99',
      ]),
    ).toBe('Olá Maria, tudo bem Maria? Pedido 99.')
  })

  it('tolera espaços dentro do placeholder', () => {
    expect(resolveTemplateBody('Olá {{ 1 }}!', ['Maria'])).toBe('Olá Maria!')
  })

  it('devolve o corpo intacto quando não há placeholder', () => {
    expect(resolveTemplateBody('Bom dia!', [])).toBe('Bom dia!')
  })

  /** Última linha de defesa: incompleto e visível é melhor que errado e silencioso. */
  it('mantém o placeholder quando falta parâmetro', () => {
    expect(resolveTemplateBody('Olá {{1}}, pedido {{2}}.', ['Maria'])).toBe(
      'Olá Maria, pedido {{2}}.',
    )
  })

  it('ignora parâmetros sobrando', () => {
    expect(resolveTemplateBody('Olá {{1}}.', ['Maria', 'sobra'])).toBe(
      'Olá Maria.',
    )
  })

  it('aceita valor vazio informado explicitamente', () => {
    expect(resolveTemplateBody('Olá {{1}}!', [''])).toBe('Olá !')
  })
})

/**
 * Caso real de produção: o corpo que chega pela propriedade do robô de Bizproc vem com
 * um par de chaves a mais, e o contato leu `Ola {Joao}` porque a substituição casava só
 * o par interno.
 */
describe('corpo com chaves em excesso', () => {
  it('substitui placeholder de três chaves sem deixar sobra', () => {
    expect(
      resolveTemplateBody(
        'Ola {{{1}}}, seja bem vindo.\nVocê é o número {{{2}}} da fila',
        ['Joao', '6'],
      ),
    ).toBe('Ola Joao, seja bem vindo.\nVocê é o número 6 da fila')
  })

  it('segue resolvendo a forma canônica de duas chaves', () => {
    expect(resolveTemplateBody('Ola {{1}}, número {{2}}', ['Joao', '6'])).toBe(
      'Ola Joao, número 6',
    )
  })
})
