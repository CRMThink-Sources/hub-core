import { describe, expect, it } from 'vitest'
import { validateContact, type TrialContact } from './trial-contact-dialog'

const valid: TrialContact = {
  name: 'Joana Silva',
  email: 'joana@acme.com',
  phone: '(11) 99999-8888',
  company: 'Acme LTDA',
}

describe('validateContact', () => {
  it('aceita contato completo', () => {
    expect(validateContact(valid)).toEqual({})
  })

  it('recusa nome só com espaços', () => {
    expect(validateContact({ ...valid, name: '   ' })).toEqual({ name: true })
  })

  it('recusa nome de um caractere', () => {
    expect(validateContact({ ...valid, name: 'J' })).toEqual({ name: true })
  })

  it('recusa e-mail malformado', () => {
    expect(validateContact({ ...valid, email: 'joana@' })).toEqual({
      email: true,
    })
  })

  it('recusa telefone e empresa vazios', () => {
    expect(validateContact({ ...valid, phone: ' ', company: '' })).toEqual({
      phone: true,
      company: true,
    })
  })

  /**
   * A regra de telefone válido é do servidor: `normalizePhoneNumber` vive na api, e
   * uma segunda cópia aqui divergiria na primeira correção. O front só barra o
   * campo em branco.
   */
  it('aceita telefone que só o servidor sabe recusar', () => {
    expect(validateContact({ ...valid, phone: '123' })).toEqual({})
  })
})
