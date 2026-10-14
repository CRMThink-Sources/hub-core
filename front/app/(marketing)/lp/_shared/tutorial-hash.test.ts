import { describe, expect, it } from 'vitest'
import type { Tutorial } from './content'
import {
  createTutorialHash,
  isTutorialHash,
  tutorialHash,
} from './tutorial-hash'

const track = {
  summary: '',
  steps: [{ screen: 'a', title: '', description: '', action: '' }],
  done: { title: '', description: '' },
}

const TUTORIALS: Tutorial<string, 'upload' | 'mapa-campos'>[] = [
  { slug: 'upload', label: 'Upload', ...track },
  {
    slug: 'mapa-campos',
    label: 'Mapa',
    variants: [
      { key: 'negocio', label: 'Negócio', ...track },
      { key: 'contato', label: 'Contato', ...track },
    ],
  },
]

const hash = createTutorialHash(TUTORIALS)

describe('createTutorialHash', () => {
  it('o primeiro tutorial é o padrão, salvo outro informado', () => {
    expect(hash.DEFAULT_TUTORIAL).toBe('upload')
    expect(createTutorialHash(TUTORIALS, 'mapa-campos').DEFAULT_TUTORIAL).toBe(
      'mapa-campos',
    )
  })

  it('resolve aba, variante e slug com hífen', () => {
    expect(hash.resolveTutorialHash('#tutorial-mapa-campos')).toEqual({
      slug: 'mapa-campos',
      variant: '',
    })
    expect(hash.resolveTutorialHash('tutorial-mapa-campos-contato')).toEqual({
      slug: 'mapa-campos',
      variant: 'contato',
    })
    expect(hash.resolveTutorialHash('#tutorial-mapa-campos-xyz')).toEqual({
      slug: 'mapa-campos',
      variant: '',
    })
  })

  it('desconhecido ou de outra seção cai no padrão', () => {
    const fallback = { slug: 'upload', variant: '' }
    expect(hash.resolveTutorialHash('#tutorial-xyz')).toEqual(fallback)
    expect(hash.resolveTutorialHash('#duvidas')).toEqual(fallback)
    expect(hash.resolveTutorialHash('')).toEqual(fallback)
  })

  it('lista as âncoras de abas e variantes', () => {
    expect(hash.allTutorialHashes()).toEqual([
      '#tutorial-upload',
      '#tutorial-mapa-campos',
      '#tutorial-mapa-campos-negocio',
      '#tutorial-mapa-campos-contato',
    ])
  })
})

describe('tutorialHash / isTutorialHash', () => {
  it('monta e reconhece âncoras de tutorial', () => {
    expect(tutorialHash('upload')).toBe('#tutorial-upload')
    expect(tutorialHash('mapa-campos', 'contato')).toBe(
      '#tutorial-mapa-campos-contato',
    )
    expect(isTutorialHash('#tutorial-xyz')).toBe(true)
    expect(isTutorialHash('#como-funciona')).toBe(false)
  })
})
