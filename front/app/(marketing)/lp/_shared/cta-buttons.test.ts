import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CtaButtons } from './cta-buttons'
import { FinalCta } from './final-cta'
import { resolveLpCtas } from './resolve-ctas'

const MARKET = 'https://www.bitrix24.com.br/apps/app/crmthink.thinkzap/'
const LABELS = {
  install: 'Instalar no Bitrix24',
  whatsapp: 'Falar no WhatsApp',
}
const MESSAGE = 'Olá! Quero saber mais.'

describe('resolveLpCtas', () => {
  it('monta os dois destinos com as envs definidas', () => {
    const ctas = resolveLpCtas({
      marketUrl: ` ${MARKET} `,
      salesWhatsapp: '+55 (11) 99999-0000',
      whatsappMessage: MESSAGE,
    })
    expect(ctas.marketUrl).toBe(MARKET)
    expect(ctas.whatsappLink).toMatch(/^https:\/\/wa\.me\/5511999990000\?text=/)
  })

  it('leva a mensagem do WhatsApp no idioma da LP', () => {
    const ctas = resolveLpCtas({
      marketUrl: MARKET,
      salesWhatsapp: '+55 (11) 99999-0000',
      whatsappMessage: 'Hi! Tell me more.',
    })
    const text = new URL(ctas.whatsappLink!).searchParams.get('text')
    expect(text).toBe('Hi! Tell me more.')
  })

  it('vira null com envs vazias', () => {
    expect(
      resolveLpCtas({
        marketUrl: '  ',
        salesWhatsapp: '',
        whatsappMessage: MESSAGE,
      }),
    ).toEqual({ marketUrl: null, whatsappLink: null })
  })
})

describe('CtaButtons', () => {
  const render = (ctas: Omit<Parameters<typeof CtaButtons>[0], 'labels'>) =>
    renderToStaticMarkup(createElement(CtaButtons, { ...ctas, labels: LABELS }))

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
      createElement(FinalCta, {
        marketUrl: null,
        whatsappLink: null,
        content: {
          finalCta: {
            title: 'Comece agora',
            subtitle: 'Instale pelo Market',
            fallback: 'Procure o app no Bitrix24 Market',
          },
          ctaButtons: LABELS,
        },
      }),
    )
    expect(html).toContain('Procure o app no Bitrix24 Market')
    expect(html).not.toContain('Instale pelo Market')
    expect(html).not.toContain('<a')
  })
})
