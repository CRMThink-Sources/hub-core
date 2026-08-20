import { describe, expect, it } from 'vitest'
import { InvalidTrialContactError, parseTrialContact } from './trial-contact'

const valid = {
  name: 'Joana Silva',
  email: 'joana@acme.com',
  phone: '11999998888',
  company: 'Acme LTDA',
}

/** O campo que reprovou, sem afirmar a mensagem — ela é texto de tela. */
function fieldOf(raw: unknown): string {
  try {
    parseTrialContact(raw)
  } catch (error) {
    if (error instanceof InvalidTrialContactError) return error.field
    throw error
  }

  throw new Error('esperava InvalidTrialContactError')
}

describe('parseTrialContact', () => {
  it('devolve os quatro campos com o telefone normalizado', () => {
    expect(parseTrialContact(valid)).toEqual({
      name: 'Joana Silva',
      email: 'joana@acme.com',
      phone: '5511999998888',
      company: 'Acme LTDA',
    })
  })

  it('prefixa 55 em número brasileiro sem código de país', () => {
    expect(parseTrialContact({ ...valid, phone: '11999998888' })).toMatchObject(
      {
        phone: '5511999998888',
      },
    )
  })

  it('preserva o código de país de número internacional', () => {
    expect(
      parseTrialContact({ ...valid, phone: '+14155551234' }),
    ).toMatchObject({ phone: '14155551234' })
  })

  it('aceita telefone com máscara', () => {
    expect(
      parseTrialContact({ ...valid, phone: '(11) 99999-8888' }),
    ).toMatchObject({ phone: '5511999998888' })
  })

  it('recusa telefone curto demais', () => {
    expect(fieldOf({ ...valid, phone: '1234' })).toBe('phone')
  })

  it('recusa telefone vazio', () => {
    expect(fieldOf({ ...valid, phone: '' })).toBe('phone')
  })

  it('recusa nome só com espaços', () => {
    expect(fieldOf({ ...valid, name: '   ' })).toBe('name')
  })

  it('recusa nome de um caractere', () => {
    expect(fieldOf({ ...valid, name: 'J' })).toBe('name')
  })

  it('recusa e-mail malformado', () => {
    expect(fieldOf({ ...valid, email: 'joana@' })).toBe('email')
  })

  it('recusa empresa vazia', () => {
    expect(fieldOf({ ...valid, company: '  ' })).toBe('company')
  })

  it('recusa campo ausente', () => {
    expect(fieldOf({ name: 'Joana Silva', email: 'joana@acme.com' })).toBe(
      'phone',
    )
  })

  it('remove espaços nas pontas de nome, e-mail e empresa', () => {
    expect(
      parseTrialContact({
        name: '  Joana Silva  ',
        email: '  joana@acme.com ',
        phone: '11999998888',
        company: ' Acme LTDA ',
      }),
    ).toEqual({
      name: 'Joana Silva',
      email: 'joana@acme.com',
      phone: '5511999998888',
      company: 'Acme LTDA',
    })
  })
})
