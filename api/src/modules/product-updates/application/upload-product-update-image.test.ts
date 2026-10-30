import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { hasPendingChanges } from '../domain/entities/product-update'
import {
  InvalidProductUpdateImageError,
  ProductUpdateImageStorageUnavailableError,
  ProductUpdateNotFoundError,
} from '../domain/errors/product-update.errors'
import type { ProductUpdateImageStorage } from '../domain/ports/product-update-image-storage.port'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
  completeProductUpdateContent,
} from '../infra/persistence/in-memory-product-update.repository.fake'
import { RemoveProductUpdateImage } from './remove-product-update-image'
import { UploadProductUpdateImage } from './upload-product-update-image'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
const GIF = Buffer.from('GIF89a')
const input = { id: 'pu-1', portalUserId: 'portal-user-2' }

function makeSut(update = buildProductUpdate()) {
  const repository = new InMemoryProductUpdateRepository([update])
  const store = vi.fn().mockResolvedValue({
    key: 'product-updates/new.png',
    url: 'https://imagens.loja.com/product-updates/new.png',
  })
  const storage = { store } as unknown as ProductUpdateImageStorage
  return {
    repository,
    store,
    useCase: new UploadProductUpdateImage(repository, storage),
  }
}

describe('UploadProductUpdateImage', () => {
  it.each([
    ['PNG', PNG, 'image/png'],
    ['JPEG', JPEG, 'image/jpeg'],
  ])(
    'grava %s com o tipo da assinatura e guarda a chave',
    async (_, data, type) => {
      const { useCase, store } = makeSut()

      const saved = await useCase.execute({ ...input, data })

      expect(store).toHaveBeenCalledWith({ data, contentType: type })
      expect(saved.content.imageKey).toBe('product-updates/new.png')
    },
  )

  it('numa publicada a imagem nova fica pendente', async () => {
    const { useCase } = makeSut(
      buildProductUpdate({
        visibility: 'PUBLISHED',
        content: completeProductUpdateContent('product-updates/old.png'),
        publishedContent: completeProductUpdateContent(
          'product-updates/old.png',
        ),
      }),
    )

    const saved = await useCase.execute({ ...input, data: PNG })

    expect(saved.publishedContent?.imageKey).toBe('product-updates/old.png')
    expect(hasPendingChanges(saved)).toBe(true)
  })

  it.each([
    ['GIF', GIF],
    ['sem arquivo', undefined],
    ['6 MB', Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)])],
  ])('recusa %s com 422 e a novidade não muda', async (_, data) => {
    const { useCase, store, repository } = makeSut()

    await expect(useCase.execute({ ...input, data })).rejects.toBeInstanceOf(
      InvalidProductUpdateImageError,
    )
    expect(store).not.toHaveBeenCalled()
    expect(repository.rows.get('pu-1')?.content.imageKey).toBeNull()
  })

  it('sem R2 configurado: 503', async () => {
    const repository = new InMemoryProductUpdateRepository([
      buildProductUpdate(),
    ])

    await expect(
      new UploadProductUpdateImage(repository, null).execute({
        ...input,
        data: PNG,
      }),
    ).rejects.toBeInstanceOf(ProductUpdateImageStorageUnavailableError)
  })

  it('falha do R2 não grava a chave', async () => {
    const { useCase, store, repository } = makeSut()
    store.mockRejectedValue(new ProductUpdateImageStorageUnavailableError('x'))

    await expect(
      useCase.execute({ ...input, data: PNG }),
    ).rejects.toBeInstanceOf(ProductUpdateImageStorageUnavailableError)
    expect(repository.rows.get('pu-1')?.content.imageKey).toBeNull()
  })

  it('404 sem a novidade', async () => {
    await expect(
      makeSut().useCase.execute({ ...input, id: 'x', data: PNG }),
    ).rejects.toBeInstanceOf(ProductUpdateNotFoundError)
  })
})

describe('RemoveProductUpdateImage', () => {
  it('tira a imagem só da versão em edição', async () => {
    const repository = new InMemoryProductUpdateRepository([
      buildProductUpdate({
        visibility: 'PUBLISHED',
        content: completeProductUpdateContent('product-updates/a.png'),
        publishedContent: completeProductUpdateContent('product-updates/a.png'),
      }),
    ])

    const saved = await new RemoveProductUpdateImage(repository).execute(input)

    expect(saved.content.imageKey).toBeNull()
    expect(saved.publishedContent?.imageKey).toBe('product-updates/a.png')
    expect(hasPendingChanges(saved)).toBe(true)
  })

  it('sem imagem não grava nada', async () => {
    const repository = new InMemoryProductUpdateRepository([
      buildProductUpdate(),
    ])
    const save = vi.spyOn(repository, 'save')

    await new RemoveProductUpdateImage(repository).execute(input)

    expect(save).not.toHaveBeenCalled()
  })
})
