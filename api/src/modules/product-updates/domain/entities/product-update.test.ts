import { describe, expect, it } from 'vitest'
import {
  buildProductUpdate,
  completeProductUpdateContent,
} from '../../infra/persistence/in-memory-product-update.repository.fake'
import {
  hasPendingChanges,
  isProductUpdateSituation,
  productUpdateSituation,
} from './product-update'

const date = new Date('2026-10-22T12:00:00.000Z')

describe('productUpdateSituation', () => {
  it('rascunho, concluído ou não, e mesmo com data de disponibilidade', () => {
    expect(productUpdateSituation(buildProductUpdate())).toBe('draft')
    expect(
      productUpdateSituation(
        buildProductUpdate({ progress: 'DONE', availableAt: date }),
      ),
    ).toBe('draft')
  })

  it('publicada pendente é "em breve"', () => {
    expect(
      productUpdateSituation(buildProductUpdate({ visibility: 'PUBLISHED' })),
    ).toBe('soon')
  })

  it('publicada concluída sem data é "aguardando revisão"', () => {
    expect(
      productUpdateSituation(
        buildProductUpdate({ visibility: 'PUBLISHED', progress: 'DONE' }),
      ),
    ).toBe('awaiting-review')
  })

  it('publicada com data é "disponível"', () => {
    expect(
      productUpdateSituation(
        buildProductUpdate({
          visibility: 'PUBLISHED',
          progress: 'DONE',
          availableAt: date,
        }),
      ),
    ).toBe('available')
  })
})

describe('isProductUpdateSituation', () => {
  it('aceita só as quatro situações', () => {
    expect(isProductUpdateSituation('awaiting-review')).toBe(true)
    expect(isProductUpdateSituation('published')).toBe(false)
    expect(isProductUpdateSituation(undefined)).toBe(false)
  })
})

describe('hasPendingChanges', () => {
  const published = (
    edit: (c: ReturnType<typeof completeProductUpdateContent>) => void,
  ) => {
    const content = completeProductUpdateContent()
    edit(content)
    return buildProductUpdate({
      visibility: 'PUBLISHED',
      content,
      publishedContent: completeProductUpdateContent(),
    })
  }

  it('publicada igual à edição não tem pendência', () => {
    expect(hasPendingChanges(published(() => undefined))).toBe(false)
  })

  it('espaço extra não é pendência', () => {
    expect(
      hasPendingChanges(published(c => (c.en.title = ` ${c.en.title}  `))),
    ).toBe(false)
  })

  it('título corrigido é pendência', () => {
    expect(hasPendingChanges(published(c => (c.en.title = 'Fixed')))).toBe(true)
  })

  it('rascunho nunca tem pendência', () => {
    expect(
      hasPendingChanges(
        buildProductUpdate({
          content: completeProductUpdateContent(),
          publishedContent: null,
        }),
      ),
    ).toBe(false)
  })
})
