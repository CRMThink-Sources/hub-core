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
const ES = getLpContent('es')
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
  /\b(Passo|Próximo|Concluir|Voltar|Tutoriais|Dúvidas|Importações|Importação|Configurações|Negócio|Planilha|Linha|Aba|Salvar|Criar|Executar|Agendamento|Responsável|para|você|não)\b/
const ACCENTS = /[ãõçáéíóúâêôàÃÕÇÁÉÍÓÚÂÊÔÀ]/

function expectEnglish(html: string) {
  const text = visibleText(html)
  expect(text).not.toMatch(PT_MARKERS)
  expect(text).not.toMatch(ACCENTS)
}

// Só o exclusivo do português: o espanhol divide muitas palavras e os acentos agudos.
const PT_IN_ES =
  /(?<!\p{L})(passo|próximo|voltar|tutoriais|dúvidas|negócios?|planilhas?|linhas?|aba|salvar|agendamento|assinatura|assinado|aguardando|adicionar|contatos?|lembrete|usuários?|nenhuma?|ajuda|também|até|já|só|um|uma|em|ao|aos|pelo|pela|do)(?!\p{L})/iu
const PT_ONLY_CHARS = /[ãõçâêôàÃÕÇÂÊÔÀ]/

function expectSpanish(html: string) {
  const text = visibleText(html)
  expect(text).not.toMatch(PT_IN_ES)
  expect(text).not.toMatch(PT_ONLY_CHARS)
}

describe.each([
  ['EN', EN],
  ['ES', ES],
] as const)('paridade PT/%s dos tutoriais', (_, other) => {
  it('têm as mesmas abas, na mesma ordem', () => {
    expect(tutorialsOf(other).map(tutorial => tutorial.slug)).toEqual(
      tutorialsOf(PT).map(tutorial => tutorial.slug),
    )
  })

  it.each([...TUTORIAL_SLUGS])('%s tem as mesmas telas nos idiomas', slug => {
    const shape = (content: LpContent) =>
      tutorialTracks(content.tutorials[slug].tutorial).map(track => ({
        key: track.key,
        screens: track.steps.map(step => step.screen),
      }))
    expect(shape(other)).toEqual(shape(PT))
  })

  it('a FAQ tem as mesmas perguntas linkadas, na mesma ordem', () => {
    const links = (content: LpContent) =>
      content.faq.items.map(item => item.link?.href ?? null)
    expect(links(other)).toEqual(links(PT))
  })
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

describe('LP em espanhol', () => {
  it('seções do servidor saem em espanhol', () => {
    const html = [
      createElement(LpHeader, { marketUrl: CTAS.marketUrl, content: ES }),
      createElement(Hero, { ...CTAS, content: ES }),
      createElement(Features, { copy: ES.features }),
      createElement(Faq, { copy: ES.faq }),
      createElement(FinalCta, { ...CTAS, content: ES }),
      createElement(FinalCta, {
        marketUrl: null,
        whatsappLink: null,
        content: ES,
      }),
      createElement(LpFooter, { content: ES }),
    ]
      .map(node => renderToStaticMarkup(node))
      .join('')
    expectSpanish(html)
    expect(html).toContain(ES.hero.title)
    expect(html).toContain(ES.finalCta.fallback)
  })

  it('seção de tutoriais sai em espanhol', () => {
    const html = renderToStaticMarkup(
      createElement(HowItWorks, { ...CTAS, content: ES }),
    )
    expectSpanish(html)
    const [first] = tutorialTracks(ES.tutorials.instalacao.tutorial)
    expect(html).toContain(ES.player.stepOf(1, first.steps.length))
  })

  const screens = TUTORIAL_SLUGS.flatMap(slug =>
    tutorialTracks(ES.tutorials[slug].tutorial).flatMap(track =>
      track.steps.map(step => [slug, track.key, step.screen, step] as const),
    ),
  )

  it.each(screens)('%s%s/%s não tem português', (slug, _, __, step) => {
    const Screen = TUTORIAL_VIEWS[slug].screens[step.screen]
    const html = withContent(
      ES,
      createElement(Screen, { action: step.action, onAdvance: () => {} }),
    )
    expectSpanish(html)
    expect(html.match(/data-hotspot/g)).toHaveLength(1)
  })
})

describe('LanguageSwitch', () => {
  const header = (content: LpContent) =>
    renderToStaticMarkup(createElement(LpHeader, { marketUrl: null, content }))

  it('em espanhol, linka português e inglês e marca o ES', () => {
    const html = header(ES)
    expect(html).toMatch(/<a[^>]*href="\/lp\/importsheet"[^>]*>PT<\/a>/)
    expect(html).toMatch(
      /<a[^>]*href="\/lp\/importsheet\?lang=en"[^>]*>EN<\/a>/,
    )
    expect(html).toMatch(
      /<span[^>]*lang="es"[^>]*aria-current="true"[^>]*>ES<\/span>/,
    )
    expect(header(PT)).toMatch(
      /<a[^>]*href="\/lp\/importsheet\?lang=es"[^>]*hrefLang="es"[^>]*>ES<\/a>/,
    )
  })

  it('linka as URLs da LP do ImportSheet', () => {
    expect(header(EN)).toMatch(/<a[^>]*href="\/lp\/importsheet"[^>]*>PT<\/a>/)
    expect(header(PT)).toMatch(
      /<a[^>]*href="\/lp\/importsheet\?lang=en"[^>]*>EN<\/a>/,
    )
  })

  it('fica no header, fora da navegação escondida no celular', () => {
    const html = header(PT)
    const nav = html.match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? ''
    expect(html).toContain('aria-current="true"')
    expect(nav).not.toContain('aria-current')
  })
})
