import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { hasPendingChanges } from '../domain/entities/product-update'
import { ProductUpdateIncompleteError } from '../domain/errors/product-update.errors'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
  completeProductUpdateContent,
} from '../infra/persistence/in-memory-product-update.repository.fake'
import { PublishProductUpdateChanges } from './publish-product-update-changes'

const availableAt = new Date('2026-10-22T12:00:00.000Z')
const input = { id: 'pu-1', portalUserId: 'portal-user-2' }

function availableWithEdit(
  edit: (c: ReturnType<typeof completeProductUpdateContent>) => void,
) {
  const content = completeProductUpdateContent()
  edit(content)
  return buildProductUpdate({
    visibility: 'PUBLISHED',
    progress: 'DONE',
    availableAt,
    content,
    publishedContent: completeProductUpdateContent(),
  })
}

const makeSut = (update: ReturnType<typeof buildProductUpdate>) => {
  const repository = new InMemoryProductUpdateRepository([update])
  return {
    repository,
    useCase: new PublishProductUpdateChanges(repository),
  }
}

describe('PublishProductUpdateChanges', () => {
  it('o cliente passa a ver o novo conteúdo e a data de disponibilidade não muda', async () => {
    const update = availableWithEdit(
      c => (c.en.title = 'Template sending, fixed'),
    )
    update.publishedAt = new Date('2026-10-01T12:00:00.000Z')
    const { useCase } = makeSut(update)

    const saved = await useCase.execute(input)

    expect(saved.publishedContent?.en.title).toBe('Template sending, fixed')
    expect(saved.availableAt).toEqual(availableAt)
    expect(saved.publishedBy).toBe('portal-user-2')
    expect(saved.publishedAt).toEqual(new Date('2026-10-01T12:00:00.000Z'))
    expect(hasPendingChanges(saved)).toBe(false)
  })

  it('alteração que esvazia um idioma: 422 e o cliente segue com o antigo', async () => {
    const { useCase, repository } = makeSut(
      availableWithEdit(c => (c.es.description = '')),
    )

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      ProductUpdateIncompleteError,
    )
    expect(repository.rows.get('pu-1')?.publishedContent).toEqual(
      completeProductUpdateContent(),
    )
  })

  it('sem alteração pendente: 409', async () => {
    const { useCase } = makeSut(availableWithEdit(() => undefined))

    await expect(useCase.execute(input)).rejects.toMatchObject({
      reason: 'no-pending-changes',
    })
  })

  it('rascunho: 409', async () => {
    const { useCase } = makeSut(
      buildProductUpdate({ content: completeProductUpdateContent() }),
    )

    await expect(useCase.execute(input)).rejects.toMatchObject({
      reason: 'not-published',
    })
  })
})
