import { describe, expect, it } from 'vitest'
import type { TemplateButton } from '@/app/hooks/use-connector-templates'
import {
  allowedButtonTypes,
  buildButtonsComponent,
  canAddButton,
  templateButtonsOf,
  validateTemplateButtons,
} from './template-buttons'

const reply = (text = 'Sim'): TemplateButton => ({ type: 'QUICK_REPLY', text })
const url = (u = 'https://loja.com', example?: string): TemplateButton => ({
  type: 'URL',
  text: 'Ver',
  url: u,
  ...(example ? { example: [example] } : {}),
})
const phone = (n = '+5511999999999'): TemplateButton => ({
  type: 'PHONE_NUMBER',
  text: 'Ligar',
  phone_number: n,
})
const code = (c = 'BLACK10'): TemplateButton => ({
  type: 'COPY_CODE',
  example: c,
})

describe('templateButtonsOf', () => {
  it('numera todos os botões e marca só os dinâmicos', () => {
    expect(
      templateButtonsOf([
        { type: 'BODY', text: 'Oi' },
        {
          type: 'BUTTONS',
          buttons: [
            reply(),
            url('https://loja.com/p/{{1}}'),
            url(),
            phone(),
            code(),
          ],
        },
      ]),
    ).toEqual([
      { index: 0, type: 'QUICK_REPLY', text: 'Sim', dynamic: false },
      { index: 1, type: 'URL', text: 'Ver', dynamic: true },
      { index: 2, type: 'URL', text: 'Ver', dynamic: false },
      { index: 3, type: 'PHONE_NUMBER', text: 'Ligar', dynamic: false },
      { index: 4, type: 'COPY_CODE', text: '', dynamic: true },
    ])
  })

  it('tipo desconhecido vira OTHER estático, e sem BUTTONS dá vazio', () => {
    expect(
      templateButtonsOf([
        {
          type: 'BUTTONS',
          buttons: [{ type: 'FLOW', text: 'Abrir' } as never],
        },
      ]),
    ).toEqual([{ index: 0, type: 'OTHER', text: 'Abrir', dynamic: false }])
    expect(templateButtonsOf([{ type: 'BODY', text: 'Oi' }])).toEqual([])
  })
})

describe('validateTemplateButtons', () => {
  const codes = (buttons: TemplateButton[], category = 'MARKETING' as const) =>
    validateTemplateButtons(buttons, category).map(v => v.code)

  it('aceita os quatro tipos válidos em Marketing', () => {
    expect(
      codes([
        reply(),
        url('https://loja.com/p/{{1}}', 'https://loja.com/p/1'),
        phone(),
        code(),
      ]),
    ).toEqual([])
  })

  it('aplica os limites de quantidade', () => {
    expect(codes(Array.from({ length: 11 }, () => reply()))).toContain(
      'too_many_buttons',
    )
    expect(codes([url(), url(), url()])).toContain('too_many_of_type')
    expect(codes([phone(), phone()])).toContain('too_many_of_type')
    expect(codes([code(), code()])).toContain('too_many_of_type')
  })

  it('aplica os limites de tamanho', () => {
    expect(codes([reply(''), reply('x'.repeat(26))])).toEqual([
      'text_required',
      'text_too_long',
    ])
    expect(codes([phone('+' + '1'.repeat(20))])).toEqual(['phone_invalid'])
    expect(codes([code('x'.repeat(16))])).toEqual(['code_too_long'])
  })

  it('variável só no fim da URL, e com exemplo', () => {
    expect(
      codes([url('https://loja.com/{{1}}/x', 'https://loja.com/1/x')]),
    ).toEqual(['url_variable_position'])
    expect(codes([url('https://loja.com/p/{{1}}')])).toEqual([
      'url_example_required',
    ])
  })

  it('respeita a categoria', () => {
    expect(codes([reply()], 'AUTHENTICATION' as never)).toEqual([
      'buttons_not_allowed',
    ])
    expect(validateTemplateButtons([code()], 'UTILITY')).toEqual([
      { index: 0, code: 'copy_code_not_allowed' },
    ])
  })
})

describe('canAddButton / allowedButtonTypes', () => {
  it('desabilita ligação depois da primeira', () => {
    expect(canAddButton([phone()], 'PHONE_NUMBER', 'UTILITY')).toBe(false)
    expect(canAddButton([phone()], 'QUICK_REPLY', 'UTILITY')).toBe(true)
  })

  it('desabilita tudo no décimo botão', () => {
    const ten = Array.from({ length: 10 }, () => reply())
    expect(canAddButton(ten, 'QUICK_REPLY', 'MARKETING')).toBe(false)
  })

  it('cupom só em Marketing e nada em Autenticação', () => {
    expect(allowedButtonTypes('UTILITY')).not.toContain('COPY_CODE')
    expect(allowedButtonTypes('MARKETING')).toContain('COPY_CODE')
    expect(allowedButtonTypes('AUTHENTICATION')).toEqual([])
  })
})

describe('buildButtonsComponent', () => {
  it('agrupa as respostas rápidas antes dos demais botões', () => {
    expect(buildButtonsComponent([url(), reply('Quero'), phone()])).toEqual({
      type: 'BUTTONS',
      buttons: [reply('Quero'), url(), phone()],
    })
  })

  it('apara campos e só manda exemplo em URL dinâmica', () => {
    expect(
      buildButtonsComponent([
        {
          type: 'URL',
          text: ' Rastrear ',
          url: ' https://loja.com/p/{{1}} ',
          example: [' https://loja.com/p/1 '],
        },
        { type: 'URL', text: 'Site', url: 'https://loja.com', example: ['x'] },
      ]),
    ).toEqual({
      type: 'BUTTONS',
      buttons: [
        {
          type: 'URL',
          text: 'Rastrear',
          url: 'https://loja.com/p/{{1}}',
          example: ['https://loja.com/p/1'],
        },
        { type: 'URL', text: 'Site', url: 'https://loja.com' },
      ],
    })
  })

  it('sem botões não gera componente', () => {
    expect(buildButtonsComponent([])).toBeNull()
  })
})
