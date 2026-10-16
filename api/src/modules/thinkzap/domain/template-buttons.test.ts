import { describe, expect, it } from 'vitest'
import { templateButtonsOf, validateTemplateButtons } from './template-buttons'

describe('templateButtonsOf', () => {
  it('numera todos os botões a partir de 0 e marca só os dinâmicos', () => {
    expect(
      templateButtonsOf([
        { type: 'BODY', text: 'Oi' },
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'QUICK_REPLY', text: 'Sim' },
            { type: 'URL', text: 'Rastrear', url: 'https://loja.com/p/{{1}}' },
            { type: 'URL', text: 'Site', url: 'https://loja.com' },
            {
              type: 'PHONE_NUMBER',
              text: 'Ligar',
              phone_number: '+5511999999999',
            },
            { type: 'COPY_CODE', example: 'BLACK10' },
          ],
        },
      ]),
    ).toEqual([
      { index: 0, type: 'QUICK_REPLY', text: 'Sim', dynamic: false },
      { index: 1, type: 'URL', text: 'Rastrear', dynamic: true },
      { index: 2, type: 'URL', text: 'Site', dynamic: false },
      { index: 3, type: 'PHONE_NUMBER', text: 'Ligar', dynamic: false },
      { index: 4, type: 'COPY_CODE', text: '', dynamic: true },
    ])
  })

  it('tipo desconhecido vira OTHER estático', () => {
    expect(
      templateButtonsOf([
        { type: 'BUTTONS', buttons: [{ type: 'FLOW', text: 'Abrir' }] },
      ]),
    ).toEqual([{ index: 0, type: 'OTHER', text: 'Abrir', dynamic: false }])
  })

  it('template sem BUTTONS dá lista vazia', () => {
    expect(templateButtonsOf([{ type: 'BODY', text: 'Oi' }])).toEqual([])
  })
})

describe('validateTemplateButtons', () => {
  const reply = (text = 'Sim') => ({ type: 'QUICK_REPLY', text })
  const url = (u = 'https://loja.com', example?: string[]) => ({
    type: 'URL',
    text: 'Ver',
    url: u,
    ...(example ? { example } : {}),
  })
  const phone = (n = '+5511999999999') => ({
    type: 'PHONE_NUMBER',
    text: 'Ligar',
    phone_number: n,
  })
  const code = (c = 'BLACK10') => ({ type: 'COPY_CODE', example: c })
  const codes = (buttons: unknown[], category = 'MARKETING' as const) =>
    validateTemplateButtons(buttons, category).map(v => v.code)

  it('aceita um conjunto válido com os quatro tipos', () => {
    expect(
      codes([
        reply(),
        url('https://loja.com/p/{{1}}', ['https://loja.com/p/1']),
        phone(),
        code(),
      ]),
    ).toEqual([])
  })

  it('sem botões é válido em qualquer categoria', () => {
    expect(validateTemplateButtons([], 'AUTHENTICATION')).toEqual([])
  })

  it('recusa mais de 10 botões', () => {
    expect(codes(Array.from({ length: 11 }, () => reply()))).toContain(
      'too_many_buttons',
    )
  })

  it('recusa três links', () => {
    expect(codes([url(), url(), url()])).toContain('too_many_of_type')
  })

  it('recusa duas ligações', () => {
    expect(codes([phone(), phone()])).toContain('too_many_of_type')
  })

  it('recusa dois copiar código', () => {
    expect(codes([code(), code()])).toContain('too_many_of_type')
  })

  it('recusa texto vazio e texto acima de 25 caracteres', () => {
    expect(codes([reply(''), reply('x'.repeat(26))])).toEqual([
      'text_required',
      'text_too_long',
    ])
  })

  it('recusa telefone acima de 20 caracteres ou com letras', () => {
    expect(codes([phone('+' + '1'.repeat(20))])).toEqual(['phone_invalid'])
    expect(codes([phone('abc')])).toEqual(['phone_invalid'])
  })

  it('recusa código acima de 15 caracteres', () => {
    expect(codes([code('x'.repeat(16))])).toEqual(['code_too_long'])
  })

  it('recusa variável fora do final da URL', () => {
    expect(
      codes([
        url('https://loja.com/{{1}}/detalhes', ['https://loja.com/1/detalhes']),
      ]),
    ).toEqual(['url_variable_position'])
  })

  it('exige exemplo na URL dinâmica', () => {
    expect(codes([url('https://loja.com/p/{{1}}')])).toEqual([
      'url_example_required',
    ])
  })

  it('não aceita botões em Autenticação', () => {
    expect(codes([reply()], 'AUTHENTICATION' as never)).toEqual([
      'buttons_not_allowed',
    ])
  })

  it('copiar código só em Marketing', () => {
    expect(validateTemplateButtons([code()], 'UTILITY')).toEqual([
      { index: 0, code: 'copy_code_not_allowed' },
    ])
  })

  it('recusa tipo não suportado', () => {
    expect(codes([{ type: 'FLOW', text: 'x' }])).toEqual(['unsupported_type'])
  })
})
