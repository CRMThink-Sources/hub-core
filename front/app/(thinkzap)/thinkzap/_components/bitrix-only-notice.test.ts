import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BitrixOnlyNotice } from './bitrix-only-notice'

const MARKET = 'https://www.bitrix24.com.br/apps/app/crmthink.thinkzap/'

const render = (marketUrl: string) =>
  renderToStaticMarkup(createElement(BitrixOnlyNotice, { marketUrl }))

describe('BitrixOnlyNotice', () => {
  it('explica a restrição e leva para a LP', () => {
    const html = render('')
    expect(html).toContain('Página restrita ao Bitrix24')
    expect(html).toContain('href="/lp/thinkzap"')
  })

  it('mostra o Market em nova aba quando configurado', () => {
    const html = render(MARKET)
    expect(html).toContain(`href="${MARKET}"`)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('esconde o Market sem URL', () => {
    expect(render('')).not.toContain('Instalar no Bitrix24')
  })
})
