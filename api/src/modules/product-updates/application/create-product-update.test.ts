import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { missingLocales } from '../domain/entities/product-update-content'
import { productUpdateSituation } from '../domain/entities/product-update'
import { InvalidProductUpdateContentError } from '../domain/errors/product-update.errors'
import { InMemoryProductUpdateRepository } from '../infra/persistence/in-memory-product-update.repository.fake'
import { CreateProductUpdate } from './create-product-update'

const now = new Date('2026-10-29T12:00:00.000Z')

function makeSut() {
  const repository = new InMemoryProductUpdateRepository([], () => now)
  const useCase = new CreateProductUpdate(
    repository,
    () => now,
    () => 'pu-new',
  )
  return { repository, useCase }
}

describe('CreateProductUpdate', () => {
  it('rascunho incompleto: só o título em português', async () => {
    const { useCase, repository } = makeSut()

    const created = await useCase.execute({
      portalUserId: 'portal-user-1',
      texts: { pt: { title: 'Envio de template com imagem' } },
    })

    expect(created).toMatchObject({
      id: 'pu-new',
      visibility: 'DRAFT',
      progress: 'PENDING',
      publishedContent: null,
      firstPublishedAt: null,
      bitrixTaskId: null,
      createdBy: 'portal-user-1',
      createdAt: now,
    })
    expect(created.content.pt.title).toBe('Envio de template com imagem')
    expect(created.content.imageKey).toBeNull()
    expect(productUpdateSituation(created)).toBe('draft')
    expect(missingLocales(created.content)).toEqual(['pt', 'en', 'es'])
    expect(repository.rows.get('pu-new')).toBeDefined()
  })

  it('sem textos cria vazio', async () => {
    const { useCase } = makeSut()

    const created = await useCase.execute({ portalUserId: 'portal-user-1' })

    expect(created.content.en).toEqual({ title: '', description: '' })
  })

  it('conteúdo inválido não grava', async () => {
    const { useCase, repository } = makeSut()

    await expect(
      useCase.execute({ portalUserId: 'p', texts: { pt: { title: 1 } } }),
    ).rejects.toBeInstanceOf(InvalidProductUpdateContentError)
    expect(repository.rows.size).toBe(0)
  })
})
