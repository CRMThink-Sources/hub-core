import { describe, expect, it } from 'vitest'
import { buildWhatsappLink } from './build-whatsapp-link'

describe('buildWhatsappLink', () => {
  it('fica só com os dígitos de um número formatado', () => {
    expect(buildWhatsappLink('+55 (11) 99999-0000', 'Oi')).toBe(
      'https://wa.me/5511999990000?text=Oi',
    )
  })

  it('codifica a mensagem para URL', () => {
    expect(buildWhatsappLink('5511999990000', 'Quero o ThinkZap & mais?')).toBe(
      'https://wa.me/5511999990000?text=Quero%20o%20ThinkZap%20%26%20mais%3F',
    )
  })

  it.each([undefined, '', '   ', '+() -'])(
    'devolve null sem dígitos (%j)',
    number => {
      expect(buildWhatsappLink(number, 'Oi')).toBeNull()
    },
  )
})
