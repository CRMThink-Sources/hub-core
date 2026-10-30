import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { productUpdateSituation } from '../domain/entities/product-update'
import {
  ProductUpdateActionRefusedError,
  ProductUpdateIncompleteError,
} from '../domain/errors/product-update.errors'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
  completeProductUpdateContent,
} from '../infra/persistence/in-memory-product-update.repository.fake'
import { PublishProductUpdateAsAvailable } from './publish-product-update-as-available'
import { UnpublishProductUpdate } from './unpublish-product-update'

const oct22 = new Date('2026-10-22T12:00:00.000Z')
const nov05 = new Date('2026-11-05T12:00:00.000Z')
const input = { id: 'pu-1', portalUserId: 'portal-user-2' }

function makeSut(update: ReturnType<typeof buildProductUpdate>, now = oct22) {
  const repository = new InMemoryProductUpdateRepository([update])
  return {
    repository,
    useCase: new PublishProductUpdateAsAvailable(repository, () => now),
  }
}

const awaitingReview = () =>
  buildProductUpdate({
    visibility: 'PUBLISHED',
    progress: 'DONE',
    content: completeProductUpdateContent(),
    publishedContent: completeProductUpdateContent(),
    firstPublishedAt: new Date('2026-10-01T12:00:00.000Z'),
  })

describe('PublishProductUpdateAsAvailable', () => {
  it('concluída passa para disponível com a data da ação', async () => {
    const { useCase } = makeSut(awaitingReview())

    const saved = await useCase.execute(input)

    expect(productUpdateSituation(saved)).toBe('available')
    expect(saved).toMatchObject({
      availableAt: oct22,
      publishedAt: oct22,
      publishedBy: 'portal-user-2',
      firstPublishedAt: new Date('2026-10-01T12:00:00.000Z'),
    })
  })

  it('rascunho concluído e completo vai direto para disponível', async () => {
    const { useCase } = makeSut(
      buildProductUpdate({
        progress: 'DONE',
        content: completeProductUpdateContent(),
      }),
    )

    const saved = await useCase.execute(input)

    expect(productUpdateSituation(saved)).toBe('available')
    expect(saved.firstPublishedAt).toEqual(oct22)
    expect(saved.publishedContent).toEqual(completeProductUpdateContent())
  })

  it('não concluída: 409 e nada muda', async () => {
    const original = buildProductUpdate({
      visibility: 'PUBLISHED',
      content: completeProductUpdateContent(),
      publishedContent: completeProductUpdateContent(),
    })
    const { useCase, repository } = makeSut(original)

    const error: unknown = await useCase.execute(input).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ProductUpdateActionRefusedError)
    expect(error).toMatchObject({ reason: 'not-done' })
    expect(repository.rows.get('pu-1')).toEqual(original)
  })

  it('idioma incompleto: 422', async () => {
    const content = completeProductUpdateContent()
    content.pt.title = ''
    const { useCase } = makeSut(
      buildProductUpdate({ progress: 'DONE', content }),
    )

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      ProductUpdateIncompleteError,
    )
  })

  it('já disponível: 409', async () => {
    const { useCase } = makeSut({ ...awaitingReview(), availableAt: oct22 })

    await expect(useCase.execute(input)).rejects.toMatchObject({
      reason: 'already-available',
    })
  })

  it('republicar mantém a data: despublicada em 22/10 volta em 05/11 com 22/10', async () => {
    const { repository } = makeSut(awaitingReview())
    await new PublishProductUpdateAsAvailable(repository, () => oct22).execute(
      input,
    )

    const unpublished = await new UnpublishProductUpdate(repository).execute(
      input,
    )
    expect(productUpdateSituation(unpublished)).toBe('draft')
    expect(unpublished.availableAt).toEqual(oct22)

    const republished = await new PublishProductUpdateAsAvailable(
      repository,
      () => nov05,
    ).execute(input)

    expect(productUpdateSituation(republished)).toBe('available')
    expect(republished.availableAt).toEqual(oct22)
    expect(republished.publishedAt).toEqual(nov05)
  })
})
