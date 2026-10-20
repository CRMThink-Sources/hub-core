import { describe, expect, it, vi } from 'vitest'
import { Request } from 'express'
import { ListWidgetTemplatesUseCase } from '@/modules/thinkzap/application/list-widget-templates'
import { WidgetTemplatesController } from './widget-templates.controller'

const templates = [
  {
    name: 'promo',
    language: 'pt_BR',
    body: 'Oferta',
    buttons: [],
    header: { type: 'IMAGE' },
  },
]

const req = {
  params: { subscriptionItemId: 'item-1' },
  domainId: 'domain-1',
  appId: 'crmthink.thinkzap',
} as unknown as Request

function makeController(headerImageUpload?: boolean) {
  const useCase = {
    execute: vi.fn().mockResolvedValue(templates),
  } as unknown as ListWidgetTemplatesUseCase
  return new WidgetTemplatesController(useCase, headerImageUpload)
}

describe('WidgetTemplatesController', () => {
  it('informa upload disponível junto da lista', async () => {
    const res = await makeController(true).perform(req)

    expect(res).toEqual({
      status: 200,
      result: { templates, headerImageUpload: true },
    })
  })

  it('upload indisponível sem armazenamento', async () => {
    const res = await makeController(false).perform(req)

    expect(res.result).toEqual({ templates, headerImageUpload: false })
  })

  it('padrão é indisponível', async () => {
    const res = await makeController().perform(req)

    expect(res.result).toMatchObject({ headerImageUpload: false })
  })
})
