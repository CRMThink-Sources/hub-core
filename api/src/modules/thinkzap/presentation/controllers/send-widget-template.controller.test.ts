/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { Request, Response } from 'express'
import { EnqueueWidgetTemplateUseCase } from '@/modules/thinkzap/application/enqueue-widget-template.use-case'
import { SendWidgetTemplateController } from './send-widget-template.controller'

const baseBody = {
  subscriptionItemId: 'i1',
  destination: '5511999999999',
  templateName: 'order_shipped',
  language: 'pt_BR',
  bodyParameters: ['PED-1'],
  templateBody: 'Seu pedido {{1}} saiu',
  entity: 'deal',
  entityId: '42',
}

function makeSut() {
  const useCase = {
    execute: vi.fn().mockResolvedValue({
      clientMessageId: 'c-1',
      status: 'queued',
      destination: '5511999999999',
      sentText: 'Seu pedido PED-1 saiu',
    }),
  } as unknown as EnqueueWidgetTemplateUseCase

  const perform = (body: unknown) =>
    new SendWidgetTemplateController(useCase).perform(
      {
        body,
        domainId: 'domain-1',
        appId: 'crmthink.thinkzap',
      } as unknown as Request,
      {} as Response,
    )

  return { useCase, perform }
}

describe('SendWidgetTemplateController — botões dinâmicos', () => {
  it('pedido sem buttonParameters continua aceito, com lista vazia', async () => {
    const sut = makeSut()

    const res = await sut.perform(baseBody)

    expect(res.status).toBe(202)
    expect(sut.useCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ buttonParameters: [] }),
    )
  })

  it('repassa os valores dos botões ao use case', async () => {
    const sut = makeSut()
    const buttonParameters = [{ index: 1, subType: 'URL', value: 'PED-1' }]

    const res = await sut.perform({ ...baseBody, buttonParameters })

    expect(res.status).toBe(202)
    expect(sut.useCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ buttonParameters }),
    )
  })

  it('400 com valor de botão vazio', async () => {
    const sut = makeSut()

    const res = await sut.perform({
      ...baseBody,
      buttonParameters: [{ index: 1, subType: 'URL', value: '  ' }],
    })

    expect(res.status).toBe(400)
    expect(sut.useCase.execute).not.toHaveBeenCalled()
  })

  it('repassa a URL https da imagem do cabeçalho', async () => {
    const sut = makeSut()

    const res = await sut.perform({
      ...baseBody,
      headerImageUrl: 'https://loja.com/promo.jpg',
    })

    expect(res.status).toBe(202)
    expect(sut.useCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ headerImageUrl: 'https://loja.com/promo.jpg' }),
    )
  })

  it('400 com imagem do cabeçalho em http://', async () => {
    const sut = makeSut()

    const res = await sut.perform({
      ...baseBody,
      headerImageUrl: 'http://loja.com/promo.jpg',
    })

    expect(res.status).toBe(400)
    expect(sut.useCase.execute).not.toHaveBeenCalled()
  })

  it('400 com index negativo', async () => {
    const sut = makeSut()

    const res = await sut.perform({
      ...baseBody,
      buttonParameters: [{ index: -1, subType: 'COPY_CODE', value: 'X' }],
    })

    expect(res.status).toBe(400)
    expect(sut.useCase.execute).not.toHaveBeenCalled()
  })
})
