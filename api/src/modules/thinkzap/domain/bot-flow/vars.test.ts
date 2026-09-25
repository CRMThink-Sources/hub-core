import { describe, expect, it } from 'vitest'
import { captureVar, renderVars, varsUsedIn } from './vars'

describe('renderVars', () => {
  it('troca a variável do sistema pelo valor do chat', () => {
    expect(renderVars('Olá {bitrix.name}!', { 'bitrix.name': 'Gustavo' })).toBe(
      'Olá Gustavo!',
    )
  })

  it('troca o que o fluxo capturou', () => {
    expect(
      renderVars('Anotei {capture.email}.', { 'capture.email': 'a@b.com' }),
    ).toBe('Anotei a@b.com.')
  })

  it('variável sem valor vira vazio: o cliente não lê chave em mensagem', () => {
    expect(renderVars('Olá {bitrix.name}!', {})).toBe('Olá !')
  })

  it('tolera espaço dentro da chave, que é o que sobra de colar do editor', () => {
    expect(renderVars('Oi { bitrix.name }', { 'bitrix.name': 'Ana' })).toBe(
      'Oi Ana',
    )
  })

  it('chave que não é nome de variável fica como está', () => {
    // Texto do operador com chaves ("{2 opções}") não é interpolação.
    expect(renderVars('{2 opções}', {})).toBe('{2 opções}')
  })

  it('substitui todas as ocorrências, não só a primeira', () => {
    expect(renderVars('{a} e {a}', { a: 'x' })).toBe('x e x')
  })
})

describe('varsUsedIn', () => {
  it('lista sem repetir o que o texto interpola', () => {
    expect(varsUsedIn('{bitrix.name}, {capture.x} e {bitrix.name}')).toEqual([
      'bitrix.name',
      'capture.x',
    ])
  })
})

describe('captureVar', () => {
  it('prefixa o nome escolhido pelo operador', () => {
    expect(captureVar(' email ')).toBe('capture.email')
  })
})
