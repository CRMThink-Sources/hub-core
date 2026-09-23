import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WALKTHROUGH } from './content'
import { InstallWalkthrough } from './install-walkthrough'
import { qrModules, SCREEN_FRAME, SCREENS } from './walkthrough-screens'

describe('InstallWalkthrough', () => {
  it('sai do servidor já no primeiro passo', () => {
    const html = renderToStaticMarkup(
      createElement(InstallWalkthrough, {
        marketUrl: null,
        whatsappLink: null,
      }),
    )
    expect(html).toContain(`Passo 1 de ${WALKTHROUGH.length}`)
    expect(html).toContain(WALKTHROUGH[0].title)
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('data-hotspot')
  })
})

describe('telas do passo a passo', () => {
  it.each(WALKTHROUGH.map(step => [step.screen, step.action] as const))(
    'a tela %s tem um único elemento destacado, rotulado "%s"',
    (screen, action) => {
      const html = renderToStaticMarkup(
        createElement(SCREENS[screen], { action, onAdvance: () => {} }),
      )
      expect(html.match(/data-hotspot/g)).toHaveLength(1)
      expect(html).toContain(`aria-label="${action}"`)
    },
  )

  it('toda tela tem moldura', () => {
    for (const step of WALKTHROUGH) {
      expect(SCREEN_FRAME[step.screen]).toBeDefined()
    }
  })
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
