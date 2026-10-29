import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { productUpdateSituation } from '../domain/entities/product-update'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
  completeProductUpdateContent,
} from '../infra/persistence/in-memory-product-update.repository.fake'
import { UnpublishProductUpdate } from './unpublish-product-update'

const input = { id: 'pu-1', portalUserId: 'portal-user-2' }
const availableAt = new Date('2026-10-22T12:00:00.000Z')
const firstPublishedAt = new Date('2026-10-01T12:00:00.000Z')

describe('UnpublishProductUpdate', () => {
  it('volta a rascunho mantendo a data de disponibilidade e a primeira publicação', async () => {
    const repository = new InMemoryProductUpdateRepository([
      buildProductUpdate({
        visibility: 'PUBLISHED',
        progress: 'DONE',
        availableAt,
        firstPublishedAt,
        content: completeProductUpdateContent(),
        publishedContent: completeProductUpdateContent(),
      }),
    ])

    const saved = await new UnpublishProductUpdate(repository).execute(input)

    expect(productUpdateSituation(saved)).toBe('draft')
    expect(saved.availableAt).toEqual(availableAt)
    expect(saved.firstPublishedAt).toEqual(firstPublishedAt)
    expect(saved.progress).toBe('DONE')
  })

  it('rascunho: 409', async () => {
    const repository = new InMemoryProductUpdateRepository([
      buildProductUpdate(),
    ])

    await expect(
      new UnpublishProductUpdate(repository).execute(input),
    ).rejects.toMatchObject({ reason: 'not-published' })
  })
})
