import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CtaButtons } from './cta-buttons'
import { FinalCta } from './final-cta'
import { resolveThinkzapCtas } from './resolve-ctas'

const MARKET = 'https://www.bitrix24.com.br/apps/app/crmthink.thinkzap/'

describe('resolveThinkzapCtas', () => {
  it('monta os dois destinos com as envs definidas', () => {
    const ctas = resolveThinkzapCtas({
      marketUrl: ` ${MARKET} `,
      salesWhatsapp: '+55 (11) 99999-0000',
    })
    expect(ctas.marketUrl).toBe(MARKET)
    expect(ctas.whatsappLink).toMatch(/^https:\/\/wa\.me\/5511999990000\?text=/)
  })

  it('vira null com envs vazias', () => {
    expect(resolveThinkzapCtas({ marketUrl: '  ', salesWhatsapp: '' })).toEqual(
      { marketUrl: null, whatsappLink: null },
    )
  })
})

describe('CtaButtons', () => {
  const render = (ctas: Parameters<typeof CtaButtons>[0]) =>
    renderToStaticMarkup(createElement(CtaButtons, ctas))

  it('renderiza os dois botões em nova aba com rel seguro', () => {
    const html = render({
      marketUrl: MARKET,
      whatsappLink: 'https://wa.me/5511999990000?text=Oi',
    })
    expect(html).toContain('Instalar no Bitrix24')
    expect(html).toContain(`href="${MARKET}"`)
    expect(html).toContain('Falar no WhatsApp')
    expect(html).toContain('href="https://wa.me/5511999990000?text=Oi"')
    expect(html.match(/target="_blank"/g)).toHaveLength(2)
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(2)
  })

  it('esconde o botão cujo destino falta', () => {
    const html = render({ marketUrl: MARKET, whatsappLink: null })
    expect(html).toContain('Instalar no Bitrix24')
    expect(html).not.toContain('Falar no WhatsApp')
  })

  it('não renderiza nada sem nenhum destino', () => {
    expect(render({ marketUrl: null, whatsappLink: null })).toBe('')
  })
})

describe('FinalCta', () => {
  it('cai no texto informativo sem nenhum CTA', () => {
    const html = renderToStaticMarkup(
      createElement(FinalCta, { marketUrl: null, whatsappLink: null }),
    )
    expect(html).toContain('Procure o ThinkZap no Bitrix24 Market')
    expect(html).not.toContain('<a')
  })
})
