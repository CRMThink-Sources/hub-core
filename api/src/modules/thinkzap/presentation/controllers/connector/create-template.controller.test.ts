/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { Request } from 'express'
import {
  CreateConnectorTemplateUseCase,
  InvalidTemplateError,
  InvalidTemplateHeaderImageError,
} from '@/modules/thinkzap/application/create-connector-template'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { TemplateImageStorageUnavailableError } from '@/modules/thinkzap/domain/ports/template-image-storage.port'
import {
  CreateTemplateController,
  headerImageRejectionMessage,
} from './create-template.controller'

/** A linha vem do path (`itemId`) e a instalação do JWT — ver `parseLineRequest`. */
function makeReq(body: unknown, itemId = 'item_1'): Request {
  return {
    params: { itemId },
    body,
    domainId: 'domain_1',
    appId: 'crmthink.thinkzap',
  } as unknown as Request
}

const validBody = {
  name: 'order_update',
  category: 'UTILITY',
  language: 'pt_BR',
  components: [{ type: 'BODY', text: 'Olá {{1}}' }],
}

function makeController(execute: () => Promise<unknown>) {
  const useCase = {
    execute: vi.fn(execute),
  } as unknown as CreateConnectorTemplateUseCase
  return { controller: new CreateTemplateController(useCase), useCase }
}

describe('CreateTemplateController', () => {
  it('200 com template criado', async () => {
    const { controller } = makeController(() =>
      Promise.resolve({
        id: 'tpl_1',
        status: 'PENDING',
        category: 'UTILITY',
      }),
    )

    const res = await controller.perform(makeReq(validBody))

    expect(res.status).toBe(200)
    expect(res.result).toEqual({
      template: { id: 'tpl_1', status: 'PENDING', category: 'UTILITY' },
    })
  })

  it('400 quando body inválido (categoria fora do enum)', async () => {
    const { controller, useCase } = makeController(() => Promise.resolve({}))

    const res = await controller.perform(
      makeReq({ ...validBody, category: 'PROMO' }),
    )

    expect(res.status).toBe(400)
    expect(useCase.execute).not.toHaveBeenCalled()
  })

  it('repassa ao use case o componente de botões com URL e exemplo', async () => {
    const { controller, useCase } = makeController(() =>
      Promise.resolve({ id: 'tpl_1', status: 'PENDING', category: 'UTILITY' }),
    )
    const buttons = {
      type: 'BUTTONS',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Sim' },
        {
          type: 'URL',
          text: 'Rastrear',
          url: 'https://loja.com/p/{{1}}',
          example: ['https://loja.com/p/1'],
        },
      ],
    }

    const res = await controller.perform(
      makeReq({ ...validBody, components: [...validBody.components, buttons] }),
    )

    expect(res.status).toBe(200)
    expect(useCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        components: [{ type: 'BODY', text: 'Olá {{1}}' }, buttons],
      }),
    )
  })

  it('repassa ao use case o cabeçalho de imagem antes do corpo', async () => {
    const { controller, useCase } = makeController(() =>
      Promise.resolve({
        id: 'tpl_1',
        status: 'PENDING',
        category: 'MARKETING',
      }),
    )
    const header = {
      type: 'HEADER',
      format: 'IMAGE',
      example: { imageUrl: 'https://loja.com/banner.png' },
    }

    const res = await controller.perform(
      makeReq({
        ...validBody,
        category: 'MARKETING',
        components: [header, ...validBody.components],
      }),
    )

    expect(res.status).toBe(200)
    expect(useCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        components: [header, { type: 'BODY', text: 'Olá {{1}}' }],
      }),
    )
  })

  it('400 sem chamar o use case com cabeçalho de vídeo', async () => {
    const { controller, useCase } = makeController(() => Promise.resolve({}))

    const res = await controller.perform(
      makeReq({
        ...validBody,
        components: [
          {
            type: 'HEADER',
            format: 'VIDEO',
            example: { imageUrl: 'https://loja.com/v.mp4' },
          },
          ...validBody.components,
        ],
      }),
    )

    expect(res.status).toBe(400)
    expect(useCase.execute).not.toHaveBeenCalled()
  })

  it('400 sem chamar o use case quando o tipo de botão não é suportado', async () => {
    const { controller, useCase } = makeController(() => Promise.resolve({}))

    const res = await controller.perform(
      makeReq({
        ...validBody,
        components: [
          ...validBody.components,
          { type: 'BUTTONS', buttons: [{ type: 'FLOW', text: 'Abrir' }] },
        ],
      }),
    )

    expect(res.status).toBe(400)
    expect(useCase.execute).not.toHaveBeenCalled()
  })

  it('400 com a mensagem quando o use case recusa os botões', async () => {
    const { controller } = makeController(() =>
      Promise.reject(
        new InvalidTemplateError('Template aceita no máximo 2 botões de link'),
      ),
    )

    const res = await controller.perform(makeReq(validBody))

    expect(res.status).toBe(400)
    expect((res.result as { error: string }).error).toContain('botões de link')
  })

  it('400 com mensagem legível quando a Meta recusa a amostra (2388215)', async () => {
    const { controller } = makeController(() =>
      Promise.reject(
        new HubMessageApiError(
          400,
          'POST',
          '/whatsapp/businesses/w/templates',
          { error: { code: 100, error_subcode: 2388215 } },
          new Error('x'),
        ),
      ),
    )

    const res = await controller.perform(makeReq(validBody))

    expect(res.status).toBe(400)
    expect((res.result as { error: string }).error).toContain(
      'recusou a imagem de exemplo',
    )
  })

  it('headerImageRejectionMessage reconhece o 380 e ignora outros códigos', () => {
    expect(headerImageRejectionMessage({ error: { code: 380 } })).toContain(
      'não conseguiu baixar',
    )
    expect(headerImageRejectionMessage({ error: { code: 3801 } })).toBeNull()
    expect(headerImageRejectionMessage({ message: 'invalid' })).toBeNull()
  })

  describe('multipart com arquivo', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    const multipartReq = (payload: unknown) =>
      Object.assign(makeReq({ payload: JSON.stringify(payload) }), {
        file: { buffer: png },
      }) as unknown as Request

    it('lê o JSON de payload e repassa os bytes do arquivo', async () => {
      const { controller, useCase } = makeController(() =>
        Promise.resolve({
          id: 'tpl_1',
          status: 'PENDING',
          category: 'MARKETING',
        }),
      )

      const res = await controller.perform(
        multipartReq({
          ...validBody,
          category: 'MARKETING',
          components: [
            { type: 'HEADER', format: 'IMAGE' },
            ...validBody.components,
          ],
        }),
      )

      expect(res.status).toBe(200)
      expect(useCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          components: [
            { type: 'HEADER', format: 'IMAGE' },
            { type: 'BODY', text: 'Olá {{1}}' },
          ],
          headerImageFile: { data: png },
        }),
      )
    })

    it('400 com payload que não é JSON', async () => {
      const { controller, useCase } = makeController(() => Promise.resolve({}))

      const res = await controller.perform(
        Object.assign(makeReq({ payload: '{quebrado' }), {
          file: { buffer: png },
        }) as unknown as Request,
      )

      expect(res.status).toBe(400)
      expect(useCase.execute).not.toHaveBeenCalled()
    })

    it('400 com arquivo e link ao mesmo tempo, vindo do use case', async () => {
      const { controller } = makeController(() =>
        Promise.reject(
          new InvalidTemplateHeaderImageError(
            'Envie o arquivo da imagem de exemplo ou informe o link, não os dois',
          ),
        ),
      )

      const res = await controller.perform(
        multipartReq({
          ...validBody,
          components: [
            {
              type: 'HEADER',
              format: 'IMAGE',
              example: { imageUrl: 'https://loja.com/a.png' },
            },
            ...validBody.components,
          ],
        }),
      )

      expect(res.status).toBe(400)
      expect((res.result as { error: string }).error).toContain('não os dois')
    })

    it('JSON sem arquivo continua igual', async () => {
      const { controller, useCase } = makeController(() =>
        Promise.resolve({
          id: 'tpl_1',
          status: 'PENDING',
          category: 'UTILITY',
        }),
      )

      await controller.perform(makeReq(validBody))

      const [input] = vi.mocked(useCase.execute).mock.calls[0] ?? []
      expect(input).not.toHaveProperty('headerImageFile')
    })
  })

  it('503 sugerindo o link quando o bucket da imagem está fora do ar', async () => {
    const { controller } = makeController(() =>
      Promise.reject(new TemplateImageStorageUnavailableError('AccessDenied')),
    )

    const res = await controller.perform(makeReq(validBody))

    expect(res.status).toBe(503)
    expect((res.result as { error: string }).error).toContain('link público')
  })

  it('400 legível quando a rota de upload da Omni não existe (405)', async () => {
    const { controller } = makeController(() =>
      Promise.reject(
        new HubMessageApiError(
          405,
          'POST',
          '/whatsapp/businesses/w/templates/media',
          { error: 'Method Not Allowed' },
          new Error('x'),
        ),
      ),
    )

    const res = await controller.perform(makeReq(validBody))

    expect(res.status).toBe(400)
    expect((res.result as { error: string }).error).toBe(
      'O envio de arquivo da imagem não está disponível no momento. Use um link público da imagem.',
    )
  })

  it('400 sugerindo o link quando falta credencial do app da Meta no upload', async () => {
    const { controller } = makeController(() =>
      Promise.reject(
        new HubMessageApiError(
          422,
          'POST',
          '/whatsapp/businesses/w/templates/media',
          { code: 'MISSING_APP_CREDENTIALS' },
          new Error('x'),
        ),
      ),
    )

    const res = await controller.perform(makeReq(validBody))

    expect(res.status).toBe(400)
    expect((res.result as { error: string }).error).toContain(
      'Use um link público',
    )
  })

  it('400 propagando mensagem da Meta em HubMessageApiError', async () => {
    const { controller } = makeController(() =>
      Promise.reject(
        new HubMessageApiError(
          400,
          'POST',
          '/whatsapp/businesses/w/templates',
          { message: 'invalid category' },
          new Error('x'),
        ),
      ),
    )

    const res = await controller.perform(makeReq(validBody))

    expect(res.status).toBe(400)
    expect((res.result as { error: string }).error).toContain(
      'invalid category',
    )
  })
})
