/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { Request } from 'express'
import {
  InvalidWidgetHeaderImageError,
  UploadWidgetTemplateHeaderImageUseCase,
} from '@/modules/thinkzap/application/upload-widget-template-header-image'
import { TemplateImageStorageUnavailableError } from '@/modules/thinkzap/domain/ports/template-image-storage.port'
import { UploadWidgetTemplateHeaderImageController } from './upload-widget-template-header-image.controller'

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])

function makeSut(execute: () => Promise<unknown>) {
  const useCase = {
    execute: vi.fn(execute),
  } as unknown as UploadWidgetTemplateHeaderImageUseCase
  const perform = (file?: { buffer: Buffer }) =>
    new UploadWidgetTemplateHeaderImageController(useCase).perform({
      file,
      domainId: 'domain-1',
      bitrixUserId: '7',
    } as unknown as Request)
  return { useCase, perform }
}

describe('UploadWidgetTemplateHeaderImageController', () => {
  it('200 com a URL, usando o domínio e o usuário do token', async () => {
    const sut = makeSut(() =>
      Promise.resolve({ url: 'https://imagens.loja.com/x.png', key: 'x.png' }),
    )

    const res = await sut.perform({ buffer: png })

    expect(res).toEqual({
      status: 200,
      result: { url: 'https://imagens.loja.com/x.png' },
    })
    expect(vi.mocked(sut.useCase.execute)).toHaveBeenCalledWith({
      data: png,
      domainId: 'domain-1',
      bitrixUserId: '7',
    })
  })

  it('400 sem arquivo', async () => {
    const sut = makeSut(() => Promise.resolve({}))

    const res = await sut.perform()

    expect(res.status).toBe(400)
    expect(vi.mocked(sut.useCase.execute)).not.toHaveBeenCalled()
  })

  it('400 com a mensagem quando o arquivo não serve', async () => {
    const sut = makeSut(() =>
      Promise.reject(
        new InvalidWidgetHeaderImageError(
          'A imagem precisa ser um arquivo JPEG ou PNG',
        ),
      ),
    )

    const res = await sut.perform({ buffer: Buffer.from('%PDF') })

    expect(res).toEqual({
      status: 400,
      result: { error: 'A imagem precisa ser um arquivo JPEG ou PNG' },
    })
  })

  it('503 sugerindo link quando o armazenamento está indisponível', async () => {
    const sut = makeSut(() =>
      Promise.reject(new TemplateImageStorageUnavailableError('AccessDenied')),
    )

    const res = await sut.perform({ buffer: png })

    expect(res.status).toBe(503)
    expect((res.result as { error: string }).error).toContain('link público')
  })
})
