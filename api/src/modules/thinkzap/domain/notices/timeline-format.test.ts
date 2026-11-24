import { describe, expect, it } from 'vitest'
import {
  bbField,
  bbLines,
  bbMessage,
  bbTitle,
  escapeBbcode,
} from './timeline-format'

describe('escapeBbcode', () => {
  it('desfaz tags digitadas sem mudar o texto visível', () => {
    const escaped = escapeBbcode('[/quote] [url=http://x]clique[/url]')

    expect(escaped).not.toContain('[/')
    expect(escaped).not.toMatch(/\[[a-z]/i)
    expect(escaped.split('\u200B').join('')).toBe(
      '[/quote] [url=http://x]clique[/url]',
    )
  })

  it('não altera texto sem colchetes', () => {
    expect(escapeBbcode('Olá, tudo bem?')).toBe('Olá, tudo bem?')
  })
})

describe('layout do comentário', () => {
  it('monta título, campo e mensagem em linha própria', () => {
    expect(
      bbLines([
        bbTitle('Enviada'),
        bbField('Para', '5511'),
        bbMessage('Mensagem', 'oi'),
      ]),
    ).toBe('[B]Enviada[/B]\n[B]Para:[/B] 5511\n[B]Mensagem:[/B]\noi')
  })

  it('não usa bloco de citação', () => {
    expect(bbMessage('Mensagem', 'oi')).not.toMatch(/quote/i)
  })

  it('mensagem vazia não gera a linha', () => {
    expect(bbMessage('Mensagem', '   ')).toBeUndefined()
    expect(bbLines([bbTitle('T'), bbMessage('Mensagem', '')])).toBe('[B]T[/B]')
  })

  it('BBCode do operador não vira marcação', () => {
    const line = bbMessage('Mensagem', 'olha [/quote][b]isso[/b]') as string

    expect(line).not.toContain('[/quote]')
    expect(line).not.toContain('[b]')
  })
})
