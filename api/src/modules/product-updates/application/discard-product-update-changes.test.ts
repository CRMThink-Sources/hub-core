import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { hasPendingChanges } from '../domain/entities/product-update'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
  completeProductUpdateContent,
} from '../infra/persistence/in-memory-product-update.repository.fake'
import { DiscardProductUpdateChanges } from './discard-product-update-changes'

const input = { id: 'pu-1', portalUserId: 'portal-user-2' }

describe('DiscardProductUpdateChanges', () => {
  it('a edição volta ao conteúdo publicado e o indicador some', async () => {
    const edited = completeProductUpdateContent('product-updates/new.png')
    edited.pt.title = 'Rascunho de correção'
    const repository = new InMemoryProductUpdateRepository([
      buildProductUpdate({
        visibility: 'PUBLISHED',
        content: edited,
        publishedContent: completeProductUpdateContent(
          'product-updates/old.png',
        ),
      }),
    ])

    const saved = await new DiscardProductUpdateChanges(repository).execute(
      input,
    )

    expect(saved.content).toEqual(
      completeProductUpdateContent('product-updates/old.png'),
    )
    expect(hasPendingChanges(saved)).toBe(false)
  })

  it('sem alteração pendente: 409', async () => {
    const repository = new InMemoryProductUpdateRepository([
      buildProductUpdate({
        visibility: 'PUBLISHED',
        content: completeProductUpdateContent(),
        publishedContent: completeProductUpdateContent(),
      }),
    ])

    await expect(
      new DiscardProductUpdateChanges(repository).execute(input),
    ).rejects.toMatchObject({ reason: 'no-pending-changes' })
  })

  it('rascunho: 409', async () => {
    const repository = new InMemoryProductUpdateRepository([
      buildProductUpdate(),
    ])

    await expect(
      new DiscardProductUpdateChanges(repository).execute(input),
    ).rejects.toMatchObject({ reason: 'not-published' })
  })
})
