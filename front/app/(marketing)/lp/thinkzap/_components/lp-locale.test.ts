import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  getLpContent,
  TUTORIAL_SLUGS,
  tutorialsOf,
  tutorialTracks,
  type LpContent,
} from './content'
import { LpContentProvider } from './content/locale-context'
import { Faq } from '../../_shared/faq'
import { Features } from './features'
import { FinalCta, LpFooter } from '../../_shared/final-cta'
import { Hero, LpHeader } from './hero'
import { HowItWorks } from './how-it-works'
import { TUTORIAL_VIEWS } from './tutorials'

const PT = getLpContent('pt')
const EN = getLpContent('en')
const CTAS = {
  marketUrl: 'https://example.com/market',
  whatsappLink: 'https://wa.me/5511999990000?text=Oi',
}

const withContent = (content: LpContent, node: ReactElement) =>
  renderToStaticMarkup(
    createElement(LpContentProvider, { content, children: node }),
  )

function visibleText(html: string): string {
  const labels = [...html.matchAll(/(?:aria-label|alt|title)="([^"]*)"/g)].map(
    match => match[1],
  )
  const text = html.replace(/<[^>]*>/g, ' ')
  return [text, ...labels].join(' ').replace(/&#x27;|&quot;|&amp;/g, ' ')
}

const PT_MARKERS =
  /\b(Passo|Próximo|Concluir|Voltar|Tutoriais|Dúvidas|Conexões|Configurações|Negócio|Linha|Enviar|Criar|Salvar|para|você|não)\b/
const ACCENTS = /[ãõçáéíóúâêôàÃÕÇÁÉÍÓÚÂÊÔÀ]/
const ALLOWED_NAMES =
  /João|José|Antônio|Conceição|São Paulo|Goiânia|Florianópolis/g

function expectEnglish(html: string) {
  const text = visibleText(html).replace(ALLOWED_NAMES, '')
  expect(text).not.toMatch(PT_MARKERS)
  expect(text).not.toMatch(ACCENTS)
}

describe('paridade PT/EN dos tutoriais', () => {
  it('têm as mesmas abas, na mesma ordem', () => {
    expect(tutorialsOf(EN).map(tutorial => tutorial.slug)).toEqual(
      tutorialsOf(PT).map(tutorial => tutorial.slug),
    )
  })

  it.each([...TUTORIAL_SLUGS])(
    '%s tem as mesmas variantes e telas nos dois idiomas',
    slug => {
      const shape = (content: LpContent) =>
        tutorialTracks(content.tutorials[slug].tutorial).map(track => ({
          key: track.key,
          screens: track.steps.map(step => step.screen),
        }))
      expect(shape(EN)).toEqual(shape(PT))
    },
  )
})

describe('LP em inglês', () => {
  it('seções do servidor saem em inglês', () => {
    const html = [
      createElement(LpHeader, { marketUrl: CTAS.marketUrl, content: EN }),
      createElement(Hero, { ...CTAS, content: EN }),
      createElement(Features, { copy: EN.features }),
      createElement(Faq, { copy: EN.faq }),
      createElement(FinalCta, { ...CTAS, content: EN }),
      createElement(FinalCta, {
        marketUrl: null,
        whatsappLink: null,
        content: EN,
      }),
      createElement(LpFooter, { content: EN }),
    ]
      .map(node => renderToStaticMarkup(node))
      .join('')
    expectEnglish(html)
    expect(html).toContain(EN.hero.title)
    // o React escapa o apóstrofo de "portal's"
    expect(html).toContain(EN.finalCta.fallback.replace(/'/g, '&#x27;'))
  })

  it('seção de tutoriais sai em inglês', () => {
    const html = renderToStaticMarkup(
      createElement(HowItWorks, { ...CTAS, content: EN }),
    )
    expectEnglish(html)
    const [first] = tutorialTracks(EN.tutorials.instalacao.tutorial)
    expect(html).toContain(EN.player.stepOf(1, first.steps.length))
  })

  const screens = TUTORIAL_SLUGS.flatMap(slug =>
    tutorialTracks(EN.tutorials[slug].tutorial).flatMap(track =>
      track.steps.map(step => [slug, track.key, step.screen, step] as const),
    ),
  )

  it.each(screens)(
    '%s%s/%s não tem texto em português',
    (slug, _, __, step) => {
      const Screen = TUTORIAL_VIEWS[slug].screens[step.screen]
      const html = withContent(
        EN,
        createElement(Screen, { action: step.action, onAdvance: () => {} }),
      )
      expectEnglish(html)
      expect(html.match(/data-hotspot/g)).toHaveLength(1)
    },
  )
})

describe('LanguageSwitch', () => {
  const header = (content: LpContent) =>
    renderToStaticMarkup(createElement(LpHeader, { marketUrl: null, content }))

  it('linka as URLs da LP do ThinkZap', () => {
    expect(header(EN)).toMatch(/<a[^>]*href="\/lp\/thinkzap"[^>]*>PT<\/a>/)
    expect(header(PT)).toMatch(
      /<a[^>]*href="\/lp\/thinkzap\?lang=en"[^>]*>EN<\/a>/,
    )
  })

  it('fica no header, fora da navegação escondida no celular', () => {
    const html = header(PT)
    const nav = html.match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? ''
    expect(html).toContain('aria-current="true"')
    expect(nav).not.toContain('aria-current')
  })
})
