import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  getLpContent,
  TUTORIAL_SLUGS,
  tutorialsOf,
  tutorialTracks,
} from './content'
import { HowItWorks } from './how-it-works'
import { allTutorialHashes } from './tutorial-hash'
import { TUTORIAL_VIEWS } from './tutorials'
import { qrModules } from './tutorials/ativacao'

const CTAS = { marketUrl: null, whatsappLink: null }
const PT = getLpContent('pt')
const TUTORIALS = tutorialsOf(PT)
const INSTALACAO = PT.tutorials.instalacao.tutorial
const ROBOS = PT.tutorials.robos.tutorial

describe('seção Tutoriais', () => {
  const html = renderToStaticMarkup(
    createElement(HowItWorks, { ...CTAS, content: PT }),
  )
  const [instalacao] = tutorialTracks(INSTALACAO)

  it('sai do servidor com as seis abas e a primeira selecionada', () => {
    expect(html.match(/role="tab"/g)).toHaveLength(TUTORIALS.length)
    for (const tutorial of TUTORIALS) {
      expect(html).toContain(`href="#tutorial-${tutorial.slug}"`)
      expect(html).toContain(`>${tutorial.label}</a>`)
    }
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1)
    expect(html).toMatch(/id="tab-instalacao"[^>]*aria-selected="true"/)
  })

  it('sai do servidor já no primeiro passo de Instalação', () => {
    expect(html).toContain(`Passo 1 de ${instalacao.steps.length}`)
    expect(html).toContain(instalacao.steps[0].title)
    expect(html).toContain('aria-live="polite"')
    expect(html.match(/data-hotspot/g)).toHaveLength(1)
  })

  it('tem alvo para cada âncora de tutorial e para o link antigo', () => {
    for (const hash of allTutorialHashes()) {
      expect(html).toContain(`id="${hash.slice(1)}"`)
    }
    expect(html).toContain('id="tutoriais"')
    expect(html).toContain('id="como-funciona"')
  })
})

describe('tutoriais', () => {
  it('seguem a ordem dos slugs, sem repetir', () => {
    expect(TUTORIALS.map(tutorial => tutorial.slug)).toEqual([
      ...TUTORIAL_SLUGS,
    ])
  })

  it('Robôs tem as variantes mensagem e template', () => {
    expect(tutorialTracks(ROBOS).map(track => track.key)).toEqual([
      'mensagem',
      'template',
    ])
  })

  const tracks = TUTORIALS.flatMap(tutorial =>
    tutorialTracks(tutorial).map(
      track =>
        [
          `${tutorial.slug}${track.key && `/${track.key}`}`,
          tutorial.slug,
          track,
        ] as const,
    ),
  )

  it.each(tracks)(
    '%s tem passos com telas únicas, cada uma com tela e moldura',
    (_, slug, track) => {
      const view = TUTORIAL_VIEWS[slug]
      const screens = track.steps.map(step => step.screen)
      expect(track.steps.length).toBeGreaterThan(0)
      expect(new Set(screens).size).toBe(screens.length)
      for (const screen of screens) {
        expect(view.screens[screen]).toBeDefined()
        expect(view.frames[screen]).toBeDefined()
      }
    },
  )

  const steps = tracks.flatMap(([name, slug, track]) =>
    track.steps.map(step => [name, step.screen, step.action, slug] as const),
  )

  it.each(steps)(
    '%s/%s tem um único elemento destacado, rotulado "%s"',
    (_, screen, action, slug) => {
      const Screen = TUTORIAL_VIEWS[slug].screens[screen]
      const html = renderToStaticMarkup(
        createElement(Screen, { action, onAdvance: () => {} }),
      )
      expect(html.match(/data-hotspot/g)).toHaveLength(1)
      expect(html).toContain(`aria-label="${action}"`)
    },
  )
})

describe('qrModules', () => {
  it('é determinístico, para não divergir entre servidor e cliente', () => {
    expect(qrModules()).toEqual(qrModules())
  })

  it('desenha os três marcadores de canto', () => {
    const grid = qrModules(21)
    for (const [row, col] of [
      [0, 0],
      [0, 14],
      [14, 0],
    ]) {
      expect(grid[row][col]).toBe(true)
      expect(grid[row + 1][col + 1]).toBe(false)
      expect(grid[row + 3][col + 3]).toBe(true)
    }
  })
})
