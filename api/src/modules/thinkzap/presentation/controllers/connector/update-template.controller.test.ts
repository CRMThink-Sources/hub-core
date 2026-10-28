/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { Request } from 'express'
import {
  TemplateNotEditableError,
  UpdateConnectorTemplateUseCase,
} from '@/modules/thinkzap/application/update-connector-template'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { TemplateNotFoundError } from '@/modules/thinkzap/domain/ports/template-errors'
import { UpdateTemplateController } from './update-template.controller'

function makeReq(body: unknown, extra: Record<string, unknown> = {}): Request {
  return {
    params: { itemId: 'item_1', templateId: 'tpl_1' },
    body,
    domainId: 'domain_1',
    appId: 'crmthink.thinkzap',
    ...extra,
  } as unknown as Request
}

const validBody = {
  name: 'promo',
  category: 'MARKETING',
  language: 'pt_BR',
  components: [{ type: 'BODY', text: 'Oferta {{1}}' }],
}

function makeController(execute: () => Promise<unknown>) {
  const useCase = {
    execute: vi.fn(execute),
  } as unknown as UpdateConnectorTemplateUseCase
  return { controller: new UpdateTemplateController(useCase), useCase }
}

describe('UpdateTemplateController', () => {
  it('200 com o template de volta em análise', async () => {
    const { controller, useCase } = makeController(() => Promise.resolve())

    const res = await controller.perform(makeReq(validBody))

    expect(res.status).toBe(200)
    expect(res.result).toEqual({ template: { id: 'tpl_1', status: 'PENDING' } })
    expect(useCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionItemId: 'item_1',
        templateId: 'tpl_1',
        name: 'promo',
      }),
    )
  })

  it('aceita multipart com o JSON em payload e o arquivo à parte', async () => {
    const { controller, useCase } = makeController(() => Promise.resolve())
    const buffer = Buffer.from([0x89, 0x50])

    await controller.perform(
      makeReq(
        {
          payload: JSON.stringify({
            ...validBody,
            components: [
              { type: 'HEADER', format: 'IMAGE' },
              ...validBody.components,
            ],
          }),
        },
        { file: { buffer } },
      ),
    )

    const [input] = vi.mocked(useCase.execute).mock.calls[0] ?? []
    expect(input).toMatchObject({ headerImageFile: { data: buffer } })
  })

  it('400 com body inválido, sem chamar o use case', async () => {
    const { controller, useCase } = makeController(() => Promise.resolve())

    const res = await controller.perform(
      makeReq({ ...validBody, category: 'PROMO' }),
    )

    expect(res.status).toBe(400)
    expect(useCase.execute).not.toHaveBeenCalled()
  })

  it('400 com a mensagem quando a edição não é permitida', async () => {
    const { controller } = makeController(() =>
      Promise.reject(
        new TemplateNotEditableError(
          'O nome do template não pode ser alterado',
        ),
      ),
    )

    const res = await controller.perform(makeReq(validBody))

    expect(res.status).toBe(400)
    expect((res.result as { error: string }).error).toContain('nome')
  })

  it('404 quando o template não existe', async () => {
    const { controller } = makeController(() =>
      Promise.reject(new TemplateNotFoundError('tpl_1')),
    )

    const res = await controller.perform(makeReq(validBody))

    expect(res.status).toBe(404)
  })

  it('400 legível quando a Meta recusa por limite de edições', async () => {
    const { controller } = makeController(() =>
      Promise.reject(
        new HubMessageApiError(
          400,
          'PUT',
          '/whatsapp/businesses/w/templates/tpl_1',
          {
            error: {
              message:
                'Message template has reached the edit limit for 24 hours',
            },
          },
          null,
        ),
      ),
    )

    const res = await controller.perform(makeReq(validBody))

    expect(res.status).toBe(400)
    expect((res.result as { error: string }).error).toContain(
      'limite de edições',
    )
  })
})
