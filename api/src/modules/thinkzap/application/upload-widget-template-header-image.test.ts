import { describe, expect, it, vi } from 'vitest'
import {
  TemplateImageStorage,
  TemplateImageStorageUnavailableError,
} from '@/modules/thinkzap/domain/ports/template-image-storage.port'
import {
  InvalidWidgetHeaderImageError,
  UploadWidgetTemplateHeaderImageUseCase,
} from './upload-widget-template-header-image'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0])

function makeSut() {
  const store = vi.fn().mockResolvedValue({
    url: 'https://imagens.loja.com/template-headers/d/2026-10/x.png',
    key: 'template-headers/d/2026-10/x.png',
  })
  const storage = { store } as unknown as TemplateImageStorage
  return { store, useCase: new UploadWidgetTemplateHeaderImageUseCase(storage) }
}

describe('UploadWidgetTemplateHeaderImageUseCase', () => {
  it.each([
    ['PNG', PNG, 'image/png'],
    ['JPEG', JPEG, 'image/jpeg'],
  ])(
    'grava %s com o tipo da assinatura e devolve a URL',
    async (_, data, type) => {
      const { useCase, store } = makeSut()

      const result = await useCase.execute({ data, domainId: 'd' })

      expect(store).toHaveBeenCalledWith({
        data,
        contentType: type,
        scope: { domainId: 'd' },
      })
      expect(result.url).toMatch(/^https:\/\//)
    },
  )

  it('recusa PDF renomeado sem gravar', async () => {
    const { useCase, store } = makeSut()

    await expect(
      useCase.execute({ data: Buffer.from('%PDF-1.7'), domainId: 'd' }),
    ).rejects.toThrow(InvalidWidgetHeaderImageError)
    expect(store).not.toHaveBeenCalled()
  })

  it('recusa 6 MB sem gravar', async () => {
    const { useCase, store } = makeSut()

    await expect(
      useCase.execute({
        data: Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]),
        domainId: 'd',
      }),
    ).rejects.toThrow('passa de 5 MB')
    expect(store).not.toHaveBeenCalled()
  })

  it('sem armazenamento configurado, indisponível', async () => {
    await expect(
      new UploadWidgetTemplateHeaderImageUseCase(null).execute({
        data: PNG,
        domainId: 'd',
      }),
    ).rejects.toBeInstanceOf(TemplateImageStorageUnavailableError)
  })
})
