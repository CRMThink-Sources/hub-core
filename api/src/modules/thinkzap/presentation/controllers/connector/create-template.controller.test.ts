/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { Request } from 'express'
import { CreateConnectorTemplateUseCase } from '@/modules/thinkzap/application/create-connector-template'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { CreateTemplateController } from './create-template.controller'

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
