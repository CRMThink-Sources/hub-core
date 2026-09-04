import { describe, expect, it } from 'vitest'
import { parseAliases } from './thinkzap-parse-aliases'

describe('parseAliases', () => {
  it('separa por vírgula e limpa espaço', () => {
    expect(parseAliases('ajuda, problema ,  tecnico')).toEqual([
      'ajuda',
      'problema',
      'tecnico',
    ])
  })

  it('campo vazio devolve undefined, não lista vazia', () => {
    // O campo é opcional no schema: gravar `[]` faria todo fluxo carregar uma lista
    // vazia por opção sem o operador ter digitado nada.
    expect(parseAliases('')).toBeUndefined()
    expect(parseAliases('   ')).toBeUndefined()
    expect(parseAliases(',,,')).toBeUndefined()
  })

  it('item vazio no meio sai fora', () => {
    // `['a', '', 'b']` casaria resposta em branco se o vazio sobrevivesse.
    expect(parseAliases('ajuda,,problema')).toEqual(['ajuda', 'problema'])
  })

  it('um item só também vale', () => {
    expect(parseAliases('ajuda')).toEqual(['ajuda'])
  })

  it('preserva acento e caixa como digitados', () => {
    // A normalização é do motor (`normalizeAnswer`): guardar já normalizado esconderia
    // do operador o que ele escreveu.
    expect(parseAliases('Técnico, AJUDA')).toEqual(['Técnico', 'AJUDA'])
  })
})
