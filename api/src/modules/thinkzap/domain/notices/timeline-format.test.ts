import { describe, expect, it } from 'vitest'
import {
  bbField,
  bbLines,
  bbQuote,
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
  it('monta título, campo e citação', () => {
    expect(
      bbLines([bbTitle('Enviada'), bbField('Para', '5511'), bbQuote('oi')]),
    ).toBe('[B]Enviada[/B]\n[B]Para:[/B] 5511\n[QUOTE]oi[/QUOTE]')
  })

  it('mensagem vazia não vira bloco de citação', () => {
    expect(bbQuote('   ')).toBeUndefined()
    expect(bbLines([bbTitle('T'), bbQuote('')])).toBe('[B]T[/B]')
  })

  it('BBCode do operador não fecha a citação do comentário', () => {
    const quote = bbQuote('olha [/quote][b]isso[/b]') as string

    expect(quote.match(/\[\/QUOTE\]/gi)).toHaveLength(1)
    expect(quote.endsWith('[/QUOTE]')).toBe(true)
  })
})
