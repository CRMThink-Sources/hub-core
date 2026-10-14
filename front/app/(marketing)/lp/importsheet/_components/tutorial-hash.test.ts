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
    expect(resolveTutorialHash('#tutorial-google')).toEqual({
      slug: 'google',
      variant: '',
    })
    expect(resolveTutorialHash('#tutorial-nova-importacao')).toEqual({
      slug: 'nova-importacao',
      variant: '',
    })
  })

  it('aceita o hash sem #', () => {
    expect(resolveTutorialHash('tutorial-erros').slug).toBe('erros')
  })

  it('sufixo desconhecido de uma aba conhecida cai na aba', () => {
    expect(resolveTutorialHash('#tutorial-mapeamento-xyz')).toEqual({
      slug: 'mapeamento',
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
    expect(resolveTutorialHash(tutorialHash('agendamento'))).toEqual({
      slug: 'agendamento',
      variant: '',
    })
  })
})

describe('allTutorialHashes', () => {
  it('tem uma âncora por aba, sem repetir', () => {
    expect(allTutorialHashes()).toEqual([
      '#tutorial-instalacao',
      '#tutorial-google',
      '#tutorial-nova-importacao',
      '#tutorial-mapeamento',
      '#tutorial-agendamento',
      '#tutorial-erros',
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
