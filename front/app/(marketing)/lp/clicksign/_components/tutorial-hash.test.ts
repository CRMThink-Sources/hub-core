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
    expect(resolveTutorialHash('#tutorial-conexao')).toEqual({
      slug: 'conexao',
      variant: '',
    })
    expect(resolveTutorialHash('#tutorial-grupo')).toEqual({
      slug: 'grupo',
      variant: '',
    })
  })

  it('aceita o hash sem #', () => {
    expect(resolveTutorialHash('tutorial-acompanhamento').slug).toBe(
      'acompanhamento',
    )
  })

  it('sufixo desconhecido de uma aba conhecida cai na aba', () => {
    expect(resolveTutorialHash('#tutorial-negocio-xyz')).toEqual({
      slug: 'negocio',
      variant: '',
    })
  })

  it('aba desconhecida, hash vazio ou de outra seção caem na instalação', () => {
    expect(DEFAULT_TUTORIAL).toBe('instalacao')
    expect(resolveTutorialHash('#tutorial-xyz')).toEqual(DEFAULT)
    expect(resolveTutorialHash('')).toEqual(DEFAULT)
    expect(resolveTutorialHash('#duvidas')).toEqual(DEFAULT)
  })

  it('ida e volta com tutorialHash', () => {
    expect(resolveTutorialHash(tutorialHash('robo'))).toEqual({
      slug: 'robo',
      variant: '',
    })
  })
})

describe('allTutorialHashes', () => {
  it('tem uma âncora por aba, sem repetir', () => {
    expect(allTutorialHashes()).toEqual([
      '#tutorial-instalacao',
      '#tutorial-conexao',
      '#tutorial-negocio',
      '#tutorial-grupo',
      '#tutorial-robo',
      '#tutorial-acompanhamento',
    ])
  })
})

describe('isTutorialHash', () => {
  it('só hashes de tutorial', () => {
    expect(isTutorialHash('#tutorial-xyz')).toBe(true)
    expect(isTutorialHash('#funcionalidades')).toBe(false)
    expect(isTutorialHash('')).toBe(false)
  })
})
