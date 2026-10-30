import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { productUpdateSituation } from '../domain/entities/product-update'
import {
  ProductUpdateActionRefusedError,
  ProductUpdateIncompleteError,
  ProductUpdateNotFoundError,
} from '../domain/errors/product-update.errors'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
  completeProductUpdateContent,
} from '../infra/persistence/in-memory-product-update.repository.fake'
import { PublishProductUpdate } from './publish-product-update'

const now = new Date('2026-10-29T12:00:00.000Z')
const input = { id: 'pu-1', portalUserId: 'portal-user-2' }

function makeSut(update = buildProductUpdate()) {
  const repository = new InMemoryProductUpdateRepository([update])
  return {
    repository,
    useCase: new PublishProductUpdate(repository, () => now),
  }
}

describe('PublishProductUpdate', () => {
  it('publica o rascunho completo em "em breve" com o snapshot da edição', async () => {
    const { useCase } = makeSut(
      buildProductUpdate({ content: completeProductUpdateContent() }),
    )

    const saved = await useCase.execute(input)

    expect(productUpdateSituation(saved)).toBe('soon')
    expect(saved).toMatchObject({
      publishedContent: completeProductUpdateContent(),
      publishedAt: now,
      publishedBy: 'portal-user-2',
      firstPublishedAt: now,
      availableAt: null,
    })
  })

  it('rascunho concluído vai para "aguardando revisão", não para disponível', async () => {
    const { useCase } = makeSut(
      buildProductUpdate({
        content: completeProductUpdateContent(),
        progress: 'DONE',
      }),
    )

    expect(productUpdateSituation(await useCase.execute(input))).toBe(
      'awaiting-review',
    )
  })

  it('republicar mantém a primeira publicação', async () => {
    const first = new Date('2026-10-01T12:00:00.000Z')
    const { useCase } = makeSut(
      buildProductUpdate({
        content: completeProductUpdateContent(),
        firstPublishedAt: first,
      }),
    )

    expect((await useCase.execute(input)).firstPublishedAt).toEqual(first)
  })

  it('falta espanhol: 422 apontando es e continua rascunho', async () => {
    const content = completeProductUpdateContent()
    content.es.description = ''
    const { useCase, repository } = makeSut(buildProductUpdate({ content }))

    const error: unknown = await useCase.execute(input).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ProductUpdateIncompleteError)
    expect((error as ProductUpdateIncompleteError).missingLocales).toEqual([
      'es',
    ])
    expect(repository.rows.get('pu-1')?.visibility).toBe('DRAFT')
  })

  it('já publicada: 409', async () => {
    const { useCase } = makeSut(
      buildProductUpdate({
        visibility: 'PUBLISHED',
        content: completeProductUpdateContent(),
      }),
    )

    await expect(useCase.execute(input)).rejects.toMatchObject({
      reason: 'already-published',
    })
  })

  it('rascunho que já foi disponível: 409 (o caminho é publicar como disponível)', async () => {
    const { useCase, repository } = makeSut(
      buildProductUpdate({
        content: completeProductUpdateContent(),
        progress: 'DONE',
        availableAt: new Date('2026-10-22T12:00:00.000Z'),
      }),
    )

    const error: unknown = await useCase.execute(input).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ProductUpdateActionRefusedError)
    expect(error).toMatchObject({ reason: 'previously-available' })
    expect(repository.rows.get('pu-1')?.visibility).toBe('DRAFT')
  })

  it('404 sem a novidade', async () => {
    await expect(
      makeSut().useCase.execute({ ...input, id: 'x' }),
    ).rejects.toBeInstanceOf(ProductUpdateNotFoundError)
  })
})
