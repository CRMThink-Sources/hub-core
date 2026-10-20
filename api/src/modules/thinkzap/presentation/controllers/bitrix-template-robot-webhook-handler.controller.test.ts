import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'

const { resolveRelatedDestinationsMock } = vi.hoisted(() => ({
  resolveRelatedDestinationsMock: vi.fn(),
}))

vi.mock('@/modules/thinkzap/application/related-destinations.resolver', () => ({
  resolveRelatedDestinations: resolveRelatedDestinationsMock,
  bizprocEntityToPlacement: (entity: string) =>
    entity === 'DEAL' ? 'CRM_DEAL_DETAIL_TAB' : null,
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import {
  BitrixTemplateRobotWebhookHandlerController,
  toParameterList,
} from './bitrix-template-robot-webhook-handler.controller'

const target = {
  item: { id: 'item_1' },
  instance: { id: 'inst_1' },
  channelId: 'chan_1',
}

const makeDeps = (
  overrides: {
    resolveTarget?: ReturnType<typeof vi.fn>
    enqueue?: ReturnType<typeof vi.fn>
    templates?: {
      name: string
      language: string
      body: string
      buttons?: unknown[]
      header?: { type: string }
    }[]
    domain?: unknown
    app?: unknown
  } = {},
) => {
  const getDomain = {
    getDomain: vi
      .fn()
      .mockResolvedValue(
        'domain' in overrides ? overrides.domain : { id: 'domain_1' },
      ),
  }
  const getApp = {
    getByAppCodeAndDomainId: vi
      .fn()
      .mockResolvedValue(
        'app' in overrides
          ? overrides.app
          : { id: 'app_1', appCodeId: 'crmthink.thinkzap' },
      ),
  }

  const enqueue =
    overrides.enqueue ??
    vi
      .fn()
      .mockImplementation((_target, input: { destination: string }) =>
        Promise.resolve({ destination: input.destination, status: 'queued' }),
      )

  const enqueueTemplateSend = {
    resolveTarget: overrides.resolveTarget ?? vi.fn().mockResolvedValue(target),
    enqueue,
  }

  const listTemplates = {
    execute: vi.fn().mockResolvedValue(overrides.templates ?? []),
  }

  const sendNotification = { execute: vi.fn().mockResolvedValue(undefined) }
  const bitrix = {}

  return {
    getDomain,
    getApp,
    enqueueTemplateSend,
    listTemplates,
    sendNotification,
    bitrix,
    enqueue,
  }
}

const makeController = (deps: ReturnType<typeof makeDeps>) =>
  new BitrixTemplateRobotWebhookHandlerController(
    deps.getDomain as never,
    deps.getApp as never,
    deps.enqueueTemplateSend as never,
    deps.listTemplates as never,
    deps.sendNotification as never,
    deps.bitrix as never,
  )

const fullProperties = {
  connector: 'item_1',
  destination: '5511999999999',
  templateName: 'order_update',
  templateLanguage: 'pt_BR',
  templateBody: 'Olá {{1}}, pedido {{2}}.',
  templateParameters: ['Ana', '42'],
}

const makeReq = (
  properties: Record<string, unknown>,
  documentId: string[] = ['crm', 'CCrmDocumentDeal', 'DEAL_10'],
): Request =>
  ({
    body: {
      document_id: documentId,
      properties,
      auth: { domain: 'test.bitrix24.com' },
    },
  }) as unknown as Request

const res = {} as Response

beforeEach(() => {
  resolveRelatedDestinationsMock.mockReset().mockResolvedValue({
    destinations: [],
  })
})

describe('BitrixTemplateRobotWebhookHandlerController', () => {
  it('enfileira um envio para o destino manual', async () => {
    const deps = makeDeps()

    const response = await makeController(deps).perform(
      makeReq(fullProperties),
      res,
    )

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ received: true, queued: 1 })
    expect(deps.enqueue).toHaveBeenCalledTimes(1)
    expect(deps.enqueue).toHaveBeenCalledWith(
      target,
      expect.objectContaining({
        subscriptionItemId: 'item_1',
        destination: '5511999999999',
        templateName: 'order_update',
        language: 'pt_BR',
        templateBody: 'Olá {{1}}, pedido {{2}}.',
        bodyParameters: ['Ana', '42'],
        entity: 'DEAL',
        entityId: '10',
      }),
    )
  })

  // Corpo gravado pela tela não vai ao catálogo; a consulta que sobra é a do
  // cabeçalho (só o catálogo sabe se o template exige imagem), uma vez por disparo.
  it('consulta o catálogo uma vez só quando a configuração tem o corpo', async () => {
    const deps = makeDeps()

    await makeController(deps).perform(makeReq(fullProperties), res)

    expect(deps.listTemplates.execute).toHaveBeenCalledTimes(1)
    expect(deps.enqueue).toHaveBeenCalledWith(
      target,
      expect.objectContaining({ templateBody: 'Olá {{1}}, pedido {{2}}.' }),
    )
  })

  it('busca o corpo no catálogo quando a configuração não tem', async () => {
    const deps = makeDeps({
      templates: [
        { name: 'order_update', language: 'pt_BR', body: 'Corpo do catálogo' },
      ],
    })

    await makeController(deps).perform(
      makeReq({ ...fullProperties, templateBody: '' }),
      res,
    )

    expect(deps.enqueue).toHaveBeenCalledWith(
      target,
      expect.objectContaining({ templateBody: 'Corpo do catálogo' }),
    )
  })

  describe('botões dinâmicos', () => {
    const promo = {
      name: 'order_update',
      language: 'pt_BR',
      body: 'Olá {{1}}, pedido {{2}}.',
      buttons: [
        { index: 0, type: 'QUICK_REPLY', text: 'Obrigado', dynamic: false },
        { index: 1, type: 'COPY_CODE', text: '', dynamic: true },
      ],
    }

    it('envia o cupom vindo do negócio com o index do botão no template', async () => {
      const deps = makeDeps({ templates: [promo] })

      await makeController(deps).perform(
        makeReq({ ...fullProperties, templateButtonParameters: ['BLACK10'] }),
        res,
      )

      expect(deps.enqueue).toHaveBeenCalledWith(
        target,
        expect.objectContaining({
          buttonParameters: [
            { index: 1, subType: 'COPY_CODE', value: 'BLACK10' },
          ],
        }),
      )
    })

    it('robô antigo, sem a propriedade, envia sem botão', async () => {
      const deps = makeDeps({ templates: [promo] })

      await makeController(deps).perform(makeReq(fullProperties), res)

      expect(deps.enqueue).toHaveBeenCalledWith(
        target,
        expect.objectContaining({ buttonParameters: [] }),
      )
    })

    it('recusa sem enfileirar quando falta valor para um botão dinâmico', async () => {
      const deps = makeDeps({
        templates: [
          {
            ...promo,
            buttons: [
              ...promo.buttons,
              { index: 2, type: 'URL', text: 'Rastrear', dynamic: true },
            ],
          },
        ],
      })

      const response = await makeController(deps).perform(
        makeReq({ ...fullProperties, templateButtonParameters: ['BLACK10'] }),
        res,
      )

      expect(response.result).toEqual({ received: true, queued: 0 })
      expect(deps.enqueue).not.toHaveBeenCalled()
      const [notice] = deps.sendNotification.execute.mock.calls[0] as [
        { message: string },
      ]
      expect(notice.message).toContain('botões que precisam de valor')
    })

    it('consulta o catálogo uma vez só para corpo e botões', async () => {
      const deps = makeDeps({ templates: [promo] })

      await makeController(deps).perform(
        makeReq({
          ...fullProperties,
          templateBody: '',
          templateButtonParameters: ['BLACK10'],
        }),
        res,
      )

      expect(deps.listTemplates.execute).toHaveBeenCalledTimes(1)
    })

    it('recusa quando o catálogo não responde e há valores de botão', async () => {
      const deps = makeDeps()
      deps.listTemplates.execute.mockRejectedValue(new Error('fora do ar'))

      const response = await makeController(deps).perform(
        makeReq({ ...fullProperties, templateButtonParameters: ['BLACK10'] }),
        res,
      )

      expect(response.result).toEqual({ received: true, queued: 0 })
      expect(deps.enqueue).not.toHaveBeenCalled()
    })
  })

  describe('imagem do cabeçalho', () => {
    const promo = {
      name: 'order_update',
      language: 'pt_BR',
      body: 'Olá {{1}}, pedido {{2}}.',
      buttons: [],
      header: { type: 'IMAGE' },
    }

    it('envia a imagem vinda do campo do negócio', async () => {
      const deps = makeDeps({ templates: [promo] })

      await makeController(deps).perform(
        makeReq({
          ...fullProperties,
          templateHeaderImageUrl: 'https://loja.com/produto-42.png',
        }),
        res,
      )

      expect(deps.enqueue).toHaveBeenCalledWith(
        target,
        expect.objectContaining({
          headerImageUrl: 'https://loja.com/produto-42.png',
        }),
      )
    })

    it('recusa sem enfileirar quando o campo do negócio está vazio', async () => {
      const deps = makeDeps({ templates: [promo] })

      const response = await makeController(deps).perform(
        makeReq({ ...fullProperties, templateHeaderImageUrl: '' }),
        res,
      )

      expect(response.result).toEqual({ received: true, queued: 0 })
      expect(deps.enqueue).not.toHaveBeenCalled()
      const [notice] = deps.sendNotification.execute.mock.calls[0] as [
        { message: string },
      ]
      expect(notice.message).toContain('exige uma imagem no cabeçalho')
    })

    it('robô antigo sem a propriedade, com template sem imagem, envia normalmente', async () => {
      const deps = makeDeps({
        templates: [{ ...promo, header: { type: 'NONE' } }],
      })

      await makeController(deps).perform(makeReq(fullProperties), res)

      expect(deps.enqueue).toHaveBeenCalledTimes(1)
      expect(deps.enqueue.mock.calls[0]?.[1]).not.toHaveProperty(
        'headerImageUrl',
      )
    })
  })

  it('envia para todos os contatos relacionados, deduplicados', async () => {
    resolveRelatedDestinationsMock.mockResolvedValue({
      destinations: [
        { phone: '5511111111111' },
        { phone: '5522222222222' },
        { phone: '5511111111111' },
      ],
    })
    const deps = makeDeps()

    const response = await makeController(deps).perform(
      makeReq({ ...fullProperties, sendToAllRelatedContacts: 'Y' }),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 2 })
    expect(deps.enqueue).toHaveBeenCalledTimes(2)
  })

  it('ignora o destino manual quando a alternância está ligada', async () => {
    resolveRelatedDestinationsMock.mockResolvedValue({
      destinations: [{ phone: '5533333333333' }],
    })
    const deps = makeDeps()

    await makeController(deps).perform(
      makeReq({ ...fullProperties, sendToAllRelatedContacts: 'Y' }),
      res,
    )

    expect(deps.enqueue).toHaveBeenCalledTimes(1)
    expect(deps.enqueue).toHaveBeenCalledWith(
      target,
      expect.objectContaining({ destination: '5533333333333' }),
    )
  })

  // Linha bloqueada, Z-API ou canal não conectado: a recusa vem de `resolveTarget`,
  // antes de qualquer destinatário ser resolvido.
  it('recusa antes de resolver destinatários quando a linha não pode enviar', async () => {
    const deps = makeDeps({
      resolveTarget: vi
        .fn()
        .mockRejectedValue(new Error('linha bloqueada ou expirada')),
    })

    const response = await makeController(deps).perform(
      makeReq({ ...fullProperties, sendToAllRelatedContacts: 'Y' }),
      res,
    )

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ received: true, queued: 0 })
    expect(resolveRelatedDestinationsMock).not.toHaveBeenCalled()
    expect(deps.enqueue).not.toHaveBeenCalled()
    expect(deps.sendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'DEAL',
        contextId: '10',
        message: expect.stringContaining(
          'não pode enviar template',
        ) as unknown as string,
      }),
    )
  })

  it('recusa quando a configuração está sem linha ou sem template', async () => {
    const deps = makeDeps()

    const response = await makeController(deps).perform(
      makeReq({ ...fullProperties, templateName: '' }),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 0 })
    expect(deps.enqueueTemplateSend.resolveTarget).not.toHaveBeenCalled()
    expect(deps.sendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          'sem linha ou sem template',
        ) as unknown as string,
      }),
    )
  })

  it('recusa quando nenhum destinatário é resolvido', async () => {
    const deps = makeDeps()

    const response = await makeController(deps).perform(
      makeReq({ ...fullProperties, destination: '   ' }),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 0 })
    expect(deps.enqueue).not.toHaveBeenCalled()
    expect(deps.sendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          'Nenhum destinatário',
        ) as unknown as string,
      }),
    )
  })

  // Lista universal: documento sem dono de CRM. Sem contatos relacionados a
  // resolver e sem timeline onde comentar.
  it('não envia por contatos relacionados fora do CRM, e não tenta comentar', async () => {
    const deps = makeDeps()

    const response = await makeController(deps).perform(
      makeReq({ ...fullProperties, sendToAllRelatedContacts: 'Y' }, [
        'lists',
        'BizprocDocument',
        '68082',
      ]),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 0 })
    expect(deps.sendNotification.execute).not.toHaveBeenCalled()
  })

  it('mantém os demais destinatários quando um falha', async () => {
    resolveRelatedDestinationsMock.mockResolvedValue({
      destinations: [
        { phone: 'telefone-invalido' },
        { phone: '5544444444444' },
      ],
    })
    const enqueue = vi
      .fn()
      .mockRejectedValueOnce(new Error('Invalid destination phone number'))
      .mockResolvedValueOnce({ destination: '5544444444444' })
    const deps = makeDeps({ enqueue })

    const response = await makeController(deps).perform(
      makeReq({ ...fullProperties, sendToAllRelatedContacts: 'Y' }),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 1 })
    expect(deps.sendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('5544444444444') as unknown as string,
      }),
    )
  })

  it('recusa quando nenhum destinatário resolvido é válido', async () => {
    const deps = makeDeps({
      enqueue: vi.fn().mockRejectedValue(new Error('Invalid destination')),
    })

    const response = await makeController(deps).perform(
      makeReq(fullProperties),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 0 })
  })

  it('responde 404 quando o domínio não é encontrado', async () => {
    const deps = makeDeps({ domain: null })

    const response = await makeController(deps).perform(
      makeReq(fullProperties),
      res,
    )

    expect(response.status).toBe(404)
  })

  it('responde 404 quando o app não está instalado', async () => {
    const deps = makeDeps({ app: null })

    const response = await makeController(deps).perform(
      makeReq(fullProperties),
      res,
    )

    expect(response.status).toBe(404)
  })

  // O aviso é observabilidade: falhar ao comentar não pode transformar um disparo
  // enfileirado em erro de automação.
  it('não derruba o disparo quando o comentário de timeline falha', async () => {
    const deps = makeDeps()
    deps.sendNotification.execute.mockRejectedValue(new Error('bitrix fora'))

    const response = await makeController(deps).perform(
      makeReq(fullProperties),
      res,
    )

    expect(response.result).toEqual({ received: true, queued: 1 })
  })
})

describe('toParameterList', () => {
  it('aceita a lista como array', () => {
    expect(toParameterList(['Ana', '42'])).toEqual(['Ana', '42'])
  })

  // O Bitrix entrega propriedade múltipla como objeto indexado em alguns caminhos.
  it('aceita o objeto indexado, na ordem dos índices', () => {
    expect(toParameterList({ '1': 'b', '0': 'a', '2': 'c' })).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('aceita um valor único como string', () => {
    expect(toParameterList('Ana')).toEqual(['Ana'])
  })

  it('trata ausência como lista vazia', () => {
    expect(toParameterList(undefined)).toEqual([])
    expect(toParameterList('')).toEqual([])
  })
})

describe('BitrixTemplateRobotWebhookHandlerController idioma da timeline', () => {
  it('enfileirado em inglês, com template e idioma do template como estão', async () => {
    const deps = makeDeps()
    const controller = new BitrixTemplateRobotWebhookHandlerController(
      deps.getDomain as never,
      deps.getApp as never,
      deps.enqueueTemplateSend as never,
      deps.listTemplates as never,
      deps.sendNotification as never,
      deps.bitrix as never,
      { byAppId: vi.fn().mockResolvedValue('en') } as never,
    )

    await controller.perform(makeReq(fullProperties), res)

    const comment = (
      deps.sendNotification.execute.mock.calls[0]?.[0] as { message: string }
    ).message
    expect(comment).toMatch(/^Template "order_update" \(pt_BR\) queued for: /)
  })
})
