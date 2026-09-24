import { describe, expect, it } from 'vitest'
import {
  allTutorialHashes,
  DEFAULT_TUTORIAL,
  isTutorialHash,
  resolveTutorialHash,
  tutorialHash,
} from './tutorial-hash'

const DEFAULT = { slug: DEFAULT_TUTORIAL, variant: '' }

describe('resolveTutorialHash', () => {
  it('reconhece a aba do hash', () => {
    expect(resolveTutorialHash('#tutorial-thinkbot')).toEqual({
      slug: 'thinkbot',
      variant: '',
    })
    expect(resolveTutorialHash('#tutorial-api-oficial')).toEqual({
      slug: 'api-oficial',
      variant: '',
    })
  })

  it('reconhece a variante da aba', () => {
    expect(resolveTutorialHash('#tutorial-robos-template')).toEqual({
      slug: 'robos',
      variant: 'template',
    })
  })

  it('variante desconhecida cai na trilha padrão da aba', () => {
    expect(resolveTutorialHash('#tutorial-robos-xyz')).toEqual({
      slug: 'robos',
      variant: '',
    })
  })

  it('aceita o hash sem #', () => {
    expect(resolveTutorialHash('tutorial-grupos').slug).toBe('grupos')
  })

  it('aba desconhecida, hash vazio ou de outra seção caem no primeiro tutorial', () => {
    expect(resolveTutorialHash('#tutorial-xyz')).toEqual(DEFAULT)
    expect(resolveTutorialHash('')).toEqual(DEFAULT)
    expect(resolveTutorialHash('#duvidas')).toEqual(DEFAULT)
  })

  it('ida e volta com tutorialHash', () => {
    expect(resolveTutorialHash(tutorialHash('robos', 'mensagem'))).toEqual({
      slug: 'robos',
      variant: 'mensagem',
    })
  })
})

describe('allTutorialHashes', () => {
  it('inclui abas e variantes, sem repetir', () => {
    const hashes = allTutorialHashes()
    expect(hashes).toContain('#tutorial-instalacao')
    expect(hashes).toContain('#tutorial-robos-template')
    expect(new Set(hashes).size).toBe(hashes.length)
  })
})

describe('isTutorialHash', () => {
  it('só hashes de tutorial', () => {
    expect(isTutorialHash('#tutorial-xyz')).toBe(true)
    expect(isTutorialHash('#como-funciona')).toBe(false)
    expect(isTutorialHash('')).toBe(false)
  })
})
