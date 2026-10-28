/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { Request } from 'express'
import { SetTemplateDefaultImageUseCase } from '@/modules/thinkzap/application/set-template-default-image'
import { InvalidTemplateHeaderImageError } from '@/modules/thinkzap/application/helpers/template-definition'
import { TemplateImageStorageUnavailableError } from '@/modules/thinkzap/domain/ports/template-image-storage.port'
import { SetTemplateDefaultImageController } from './set-template-default-image.controller'

function makeReq(body: unknown, extra: Record<string, unknown> = {}): Request {
  return {
    params: { itemId: 'item_1', name: 'promo', language: 'pt_BR' },
    body,
    domainId: 'domain_1',
    appId: 'crmthink.thinkzap',
    ...extra,
  } as unknown as Request
}

function makeController(execute: () => Promise<unknown>) {
  const useCase = {
    execute: vi.fn(execute),
  } as unknown as SetTemplateDefaultImageUseCase
  return {
    controller: new SetTemplateDefaultImageController(useCase),
    useCase,
  }
}

describe('SetTemplateDefaultImageController', () => {
  it('200 com a URL da imagem padrão, a partir do link', async () => {
    const { controller, useCase } = makeController(() =>
      Promise.resolve({ headerImageUrl: 'https://loja.com/a.png' }),
    )

    const res = await controller.perform(
      makeReq({ imageUrl: 'https://loja.com/a.png' }),
    )

    expect(res.status).toBe(200)
    expect(res.result).toEqual({ headerImageUrl: 'https://loja.com/a.png' })
    expect(useCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'promo',
        language: 'pt_BR',
        imageUrl: 'https://loja.com/a.png',
      }),
    )
  })

  it('repassa o arquivo do multipart', async () => {
    const { controller, useCase } = makeController(() =>
      Promise.resolve({ headerImageUrl: 'https://x/y.png' }),
    )
    const buffer = Buffer.from([0x89, 0x50])

    await controller.perform(makeReq({}, { file: { buffer } }))

    const [input] = vi.mocked(useCase.execute).mock.calls[0] ?? []
    expect(input).toMatchObject({ imageFile: { data: buffer } })
    expect(input).not.toHaveProperty('imageUrl')
  })

  it('400 com a mensagem da imagem inválida', async () => {
    const { controller } = makeController(() =>
      Promise.reject(
        new InvalidTemplateHeaderImageError(
          'Link do WhatsApp/Meta expira e não vale como imagem padrão',
        ),
      ),
    )

    const res = await controller.perform(
      makeReq({ imageUrl: 'https://scontent.whatsapp.net/a.jpg' }),
    )

    expect(res.status).toBe(400)
    expect((res.result as { error: string }).error).toContain('expira')
  })

  it('503 sugerindo o link quando o bucket está fora do ar', async () => {
    const { controller } = makeController(() =>
      Promise.reject(new TemplateImageStorageUnavailableError('down')),
    )

    const res = await controller.perform(makeReq({}))

    expect(res.status).toBe(503)
  })
})
