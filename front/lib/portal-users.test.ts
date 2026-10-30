import { describe, expect, it } from 'vitest'
import { parseBitrixUserId } from './portal-users'

describe('parseBitrixUserId', () => {
  it('vazio ou só espaços: sem vínculo', () => {
    expect(parseBitrixUserId('')).toEqual({ valid: true, value: null })
    expect(parseBitrixUserId('   ')).toEqual({ valid: true, value: null })
  })

  it('inteiro positivo, com espaços em volta aparados', () => {
    expect(parseBitrixUserId('42')).toEqual({ valid: true, value: 42 })
    expect(parseBitrixUserId(' 7 ')).toEqual({ valid: true, value: 7 })
  })

  it.each(['0', '-3', '1.5', '1,5', 'abc', '4x', '#42', '2147483648'])(
    '%j é inválido',
    raw => {
      expect(parseBitrixUserId(raw)).toEqual({ valid: false })
    },
  )

  it('aceita o maior valor da coluna', () => {
    expect(parseBitrixUserId('2147483647')).toEqual({
      valid: true,
      value: 2147483647,
    })
  })
})
