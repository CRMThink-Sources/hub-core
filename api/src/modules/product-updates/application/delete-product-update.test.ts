import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import {
  ProductUpdateActionRefusedError,
  ProductUpdateNotFoundError,
} from '../domain/errors/product-update.errors'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
} from '../infra/persistence/in-memory-product-update.repository.fake'
import { DeleteProductUpdate } from './delete-product-update'

const input = { id: 'pu-1', portalUserId: 'portal-user-2' }

describe('DeleteProductUpdate', () => {
  it('exclui rascunho nunca publicado', async () => {
    const repository = new InMemoryProductUpdateRepository([
      buildProductUpdate(),
    ])

    await new DeleteProductUpdate(repository).execute(input)

    expect(repository.rows.has('pu-1')).toBe(false)
  })

  it.each([
    ['publicada', 'PUBLISHED' as const],
    ['despublicada', 'DRAFT' as const],
  ])('%s alguma vez: 409 e continua existindo', async (_, visibility) => {
    const repository = new InMemoryProductUpdateRepository([
      buildProductUpdate({
        visibility,
        firstPublishedAt: new Date('2026-10-01T12:00:00.000Z'),
      }),
    ])

    const error: unknown = await new DeleteProductUpdate(repository)
      .execute(input)
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ProductUpdateActionRefusedError)
    expect(error).toMatchObject({ reason: 'published-before' })
    expect(repository.rows.has('pu-1')).toBe(true)
  })

  it('404 sem a novidade', async () => {
    await expect(
      new DeleteProductUpdate(new InMemoryProductUpdateRepository()).execute(
        input,
      ),
    ).rejects.toBeInstanceOf(ProductUpdateNotFoundError)
  })
})
