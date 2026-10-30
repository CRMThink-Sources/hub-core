import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { hasPendingChanges } from '../domain/entities/product-update'
import {
  InvalidProductUpdateContentError,
  ProductUpdateNotFoundError,
} from '../domain/errors/product-update.errors'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
  completeProductUpdateContent,
} from '../infra/persistence/in-memory-product-update.repository.fake'
import { UpdateProductUpdateContent } from './update-product-update-content'

const availableAt = new Date('2026-10-22T12:00:00.000Z')

const textsOf = (content = completeProductUpdateContent()) => ({
  pt: content.pt,
  en: content.en,
  es: content.es,
})

describe('UpdateProductUpdateContent', () => {
  it('salvar numa publicada não muda publishedContent', async () => {
    const repository = new InMemoryProductUpdateRepository([
      buildProductUpdate({
        visibility: 'PUBLISHED',
        progress: 'DONE',
        availableAt,
        content: completeProductUpdateContent('product-updates/a.png'),
        publishedContent: completeProductUpdateContent('product-updates/a.png'),
      }),
    ])
    const texts = textsOf()
    texts.en = { ...texts.en, title: 'Template sending, fixed' }

    const saved = await new UpdateProductUpdateContent(repository).execute({
      id: 'pu-1',
      portalUserId: 'portal-user-2',
      texts,
    })

    expect(saved.content.en.title).toBe('Template sending, fixed')
    expect(saved.publishedContent?.en.title).toBe('Template sending')
    expect(saved.availableAt).toEqual(availableAt)
    expect(hasPendingChanges(saved)).toBe(true)
  })

  it('mantém a imagem da versão em edição', async () => {
    const repository = new InMemoryProductUpdateRepository([
      buildProductUpdate({
        content: completeProductUpdateContent('product-updates/a.png'),
      }),
    ])

    const saved = await new UpdateProductUpdateContent(repository).execute({
      id: 'pu-1',
      portalUserId: 'p',
      texts: { pt: { title: 'Outro' } },
    })

    expect(saved.content.imageKey).toBe('product-updates/a.png')
    expect(saved.content.pt).toEqual({ title: 'Outro', description: '' })
  })

  it('404 sem a novidade', async () => {
    await expect(
      new UpdateProductUpdateContent(
        new InMemoryProductUpdateRepository(),
      ).execute({ id: 'x', portalUserId: 'p', texts: {} }),
    ).rejects.toBeInstanceOf(ProductUpdateNotFoundError)
  })

  it('conteúdo inválido não grava', async () => {
    const original = buildProductUpdate({
      content: completeProductUpdateContent(),
    })
    const repository = new InMemoryProductUpdateRepository([original])

    await expect(
      new UpdateProductUpdateContent(repository).execute({
        id: 'pu-1',
        portalUserId: 'p',
        texts: { es: { description: 'x'.repeat(5001) } },
      }),
    ).rejects.toBeInstanceOf(InvalidProductUpdateContentError)
    expect(repository.rows.get('pu-1')?.content).toEqual(original.content)
  })
})
