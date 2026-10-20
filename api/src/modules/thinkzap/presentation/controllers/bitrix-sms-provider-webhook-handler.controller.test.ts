import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'

const { smsSender } = vi.hoisted(() => ({
  smsSender: {
    codePrefix: 'thinkzap_sms',
    handlerUrl: 'https://api.test/api/thinkzap/webhooks/bitrix/sms-provider',
  },
}))

vi.mock('@/config/env', () => ({
  env: { bitrix: { smsSender } },
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { WidgetTemplate } from '@/modules/thinkzap/application/list-widget-templates'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { BitrixSmsProviderWebhookHandlerController } from './bitrix-sms-provider-webhook-handler.controller'
import { thinkzapError } from '@/modules/thinkzap/errors/catalog'

const ZAPI_LINE: SubscriptionItem = {
  id: '4821',
  name: 'Comercial',
  subscription: 'sub-1',
  status: 'active',
  settings: DEFAULT_CONNECTOR_SETTINGS,
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'TOKEN',
  },
}

const HUB_LINE: SubscriptionItem = {
  ...ZAPI_LINE,
  metadata: {
    provider: 'HUBMESSAGE',
    hubmessageChannelId: 'C-9',
    wabaId: 'W-9',
  },
}

const NONE_ITEM: SubscriptionItem = {
  ...ZAPI_LINE,
  metadata: { provider: 'NONE' },
}

type DepOverrides = {
  item?: SubscriptionItem
  /** `active` por padrão; qualquer outro valor deriva de assinatura sem período. */
  subscriptionStatus?: 'active' | 'cancelled'
  templates?: WidgetTemplate[]
  existingRow?: unknown
  domain?: unknown
  app?: unknown
  resolveTarget?: ReturnType<typeof vi.fn>
  enqueueText?: ReturnType<typeof vi.fn>
  enqueueTemplate?: ReturnType<typeof vi.fn>
}

const makeDeps = (overrides: DepOverrides = {}) => {
  const item = overrides.item ?? ZAPI_LINE

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

  const getAplicationContext = {
    execute: vi.fn().mockResolvedValue({
      subscriptions: [
        { status: overrides.subscriptionStatus ?? 'active', items: [item] },
      ],
    }),
  }

  const enqueueWidgetMessage = {
    execute:
      overrides.enqueueText ?? vi.fn().mockResolvedValue({ status: 'queued' }),
  }

  const enqueueTemplateSend = {
    resolveTarget:
      overrides.resolveTarget ??
      vi
        .fn()
        .mockResolvedValue({ item, instance: { id: 'i1' }, channelId: 'C-9' }),
    enqueue:
      overrides.enqueueTemplate ??
      vi.fn().mockResolvedValue({ status: 'queued' }),
  }

  const listTemplates = {
    execute: vi.fn().mockResolvedValue(overrides.templates ?? []),
  }

  const outbox = {
    findBySmsMessageId: vi
      .fn()
      .mockResolvedValue(overrides.existingRow ?? null),
  }

  const bitrix = { callMethod: vi.fn().mockResolvedValue({}) }

  const controller = new BitrixSmsProviderWebhookHandlerController(
    getDomain as never,
    getApp as never,
    getAplicationContext as never,
    enqueueWidgetMessage as never,
    enqueueTemplateSend as never,
    listTemplates as never,
    outbox as never,
    bitrix,
  )

  return {
    controller,
    getDomain,
    getApp,
    enqueueWidgetMessage,
    enqueueTemplateSend,
    listTemplates,
    outbox,
    bitrix,
  }
}

const request = (body: Record<string, unknown>) =>
  ({
    body: {
      code: 'thinkzap_sms_4821',
      type: 'SMS',
      message_id: 'msg-1',
      message_to: '5511999998888',
      message_body: 'Promoção até sexta',
      auth: { domain: 'cliente.bitrix24.com.br', access_token: 't' },
      ...body,
    },
  }) as unknown as Request

/** `CODE` de sender de template: prefixo, item, template e idioma, separados por ponto. */
const TEMPLATE_CODE = 'thinkzap_sms.4821.boas_vindas.pt_BR'

const response = {} as Response

const statusReported = (bitrix: { callMethod: ReturnType<typeof vi.fn> }) =>
  bitrix.callMethod.mock.calls
    .filter(([method]) => method === 'messageservice.message.status.update')
    .map(([, params]) => (params as { STATUS: string }).STATUS)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resolução da instalação e da linha', () => {
  it('responde 404 e não grava nada quando o domínio é desconhecido', async () => {
    const deps = makeDeps({ domain: null })

    const result = await deps.controller.perform(request({}), response)

    expect(result.status).toBe(404)
    expect(deps.enqueueWidgetMessage.execute).not.toHaveBeenCalled()
  })

  it('responde 404 quando o app não está instalado no domínio', async () => {
    const deps = makeDeps({ app: null })

    expect((await deps.controller.perform(request({}), response)).status).toBe(
      404,
    )
  })

  it('resolve a linha pelo code do sender', async () => {
    const deps = makeDeps()

    await deps.controller.perform(request({}), response)

    expect(deps.enqueueWidgetMessage.execute).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionItemId: '4821' }),
    )
  })

  it('responde 404 no sender órfão', async () => {
    const deps = makeDeps()

    const result = await deps.controller.perform(
      request({ code: 'thinkzap_sms_9999' }),
      response,
    )

    expect(result.status).toBe(404)
    expect(deps.enqueueWidgetMessage.execute).not.toHaveBeenCalled()
  })

  it('responde 404 no code que não é do ThinkZap', async () => {
    const deps = makeDeps()

    expect(
      (
        await deps.controller.perform(
          request({ code: 'outro_app_1' }),
          response,
        )
      ).status,
    ).toBe(404)
  })

  it('responde 422 no code de item que não é linha, sem chamar o provider', async () => {
    const deps = makeDeps({ item: NONE_ITEM })

    const result = await deps.controller.perform(request({}), response)

    expect(result.status).toBe(422)
    expect(deps.enqueueWidgetMessage.execute).not.toHaveBeenCalled()
  })
})

describe('ordem das recusas', () => {
  it('recusa linha sem habilitação com 200 e sem row de outbox', async () => {
    const deps = makeDeps({ subscriptionStatus: 'cancelled' })

    const result = await deps.controller.perform(request({}), response)

    expect(result.status).toBe(200)
    expect(deps.enqueueWidgetMessage.execute).not.toHaveBeenCalled()
    expect(statusReported(deps.bitrix)).toEqual(['failed'])
  })

  it('avalia habilitação antes do conteúdo', async () => {
    const deps = makeDeps({
      subscriptionStatus: 'cancelled',
      item: HUB_LINE,
    })

    const result = await deps.controller.perform(
      request({ message_body: 'sem prefixo nenhum' }),
      response,
    )

    expect(result.result).toMatchObject({ reason: 'line-not-entitled' })
    expect(deps.listTemplates.execute).not.toHaveBeenCalled()
  })

  it('recusa telefone inválido com 200 e sem row', async () => {
    const deps = makeDeps({
      enqueueText: vi
        .fn()
        .mockRejectedValue(new Error('Invalid destination phone number')),
    })

    const result = await deps.controller.perform(
      request({ message_to: 'não é telefone' }),
      response,
    )

    expect(result.status).toBe(200)
    expect(statusReported(deps.bitrix)).toEqual(['failed'])
  })
})

describe('linha Z-API', () => {
  it('enfileira o corpo como texto, sem transformação', async () => {
    const deps = makeDeps()

    await deps.controller.perform(request({}), response)

    expect(deps.enqueueWidgetMessage.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Promoção até sexta',
        destination: '5511999998888',
        smsSenderCode: 'thinkzap_sms_4821',
        smsMessageId: 'msg-1',
      }),
    )
  })

  it('reporta queued ao aceitar', async () => {
    const deps = makeDeps()

    await deps.controller.perform(request({}), response)

    expect(deps.bitrix.callMethod).toHaveBeenCalledWith(
      'messageservice.message.status.update',
      { CODE: 'thinkzap_sms_4821', MESSAGE_ID: 'msg-1', STATUS: 'queued' },
    )
  })
})

describe('linha HubMessage', () => {
  const templates: WidgetTemplate[] = [
    {
      name: 'boas_vindas',
      language: 'pt_BR',
      body: 'Olá {{1}}, sua consulta é dia {{2}}.',
      buttons: [],
      header: { type: 'NONE' },
    },
    {
      name: 'rastreio',
      language: 'pt_BR',
      body: 'Seu pedido {{1}} saiu.',
      buttons: [{ index: 0, type: 'URL', text: 'Rastrear', dynamic: true }],
      header: { type: 'NONE' },
    },
    {
      name: 'promo_imagem',
      language: 'pt_BR',
      body: 'Oferta para você, {{1}}!',
      buttons: [],
      header: { type: 'IMAGE' },
    },
    {
      name: 'pesquisa',
      language: 'pt_BR',
      body: 'Gostou do atendimento, {{1}}?',
      buttons: [
        { index: 0, type: 'QUICK_REPLY', text: 'Sim', dynamic: false },
        { index: 1, type: 'QUICK_REPLY', text: 'Não', dynamic: false },
      ],
      header: { type: 'NONE' },
    },
  ]

  const hubDeps = (overrides: DepOverrides = {}) =>
    makeDeps({ item: HUB_LINE, templates, ...overrides })

  /** Sender **de template**: o template vem do `CODE`, o corpo traz só os valores. */
  const templateRequest = (body: string, code = TEMPLATE_CODE) =>
    request({ code, message_body: body })

  it('enfileira o template que o CODE declara, com os valores do corpo', async () => {
    const deps = hubDeps()

    const result = await deps.controller.perform(
      templateRequest('João\n10/09'),
      response,
    )

    expect(result.status).toBe(200)
    expect(deps.enqueueTemplateSend.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        templateName: 'boas_vindas',
        language: 'pt_BR',
        bodyParameters: ['João', '10/09'],
        templateBody: 'Olá {{1}}, sua consulta é dia {{2}}.',
        smsMessageId: 'msg-1',
      }),
    )
  })

  it('linha no limite diário: reporta failed ao Bitrix24 sem enfileirar', async () => {
    const deps = hubDeps({
      enqueueTemplate: vi
        .fn()
        .mockRejectedValue(thinkzapError('thinkzap.line.daily_limit_reached')),
    })

    const result = await deps.controller.perform(
      templateRequest('João\n10/09'),
      response,
    )

    expect(result.status).toBe(200)
    expect(statusReported(deps.bitrix)).toEqual(['failed'])
  })

  it('aceita valores separados por ponto e vírgula numa linha só', async () => {
    const deps = hubDeps()

    await deps.controller.perform(templateRequest('João;10/09'), response)

    expect(deps.enqueueTemplateSend.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ bodyParameters: ['João', '10/09'] }),
    )
  })

  it('recusa template ausente do catálogo da linha', async () => {
    const deps = hubDeps()

    const result = await deps.controller.perform(
      templateRequest('João\n10/09', 'thinkzap_sms.4821.inexistente.pt_BR'),
      response,
    )

    expect(result.result).toMatchObject({ reason: 'template-not-in-catalog' })
    expect(statusReported(deps.bitrix)).toEqual(['failed'])
  })

  it('recusa template com botão dinâmico, sem enfileirar', async () => {
    const deps = hubDeps()

    const result = await deps.controller.perform(
      templateRequest('PED-1', 'thinkzap_sms.4821.rastreio.pt_BR'),
      response,
    )

    expect(result.result).toMatchObject({
      reason: 'template-dynamic-button-unsupported',
    })
    expect(deps.enqueueTemplateSend.enqueue).not.toHaveBeenCalled()
    expect(statusReported(deps.bitrix)).toEqual(['failed'])
  })

  it('recusa template com cabeçalho de imagem, sem enfileirar', async () => {
    const deps = hubDeps()

    const result = await deps.controller.perform(
      templateRequest('Ana', 'thinkzap_sms.4821.promo_imagem.pt_BR'),
      response,
    )

    expect(result.result).toMatchObject({
      reason: 'template-image-header-unsupported',
    })
    expect(deps.enqueueTemplateSend.enqueue).not.toHaveBeenCalled()
    expect(statusReported(deps.bitrix)).toEqual(['failed'])
  })

  it('enfileira template só com respostas rápidas', async () => {
    const deps = hubDeps()

    await deps.controller.perform(
      templateRequest('João', 'thinkzap_sms.4821.pesquisa.pt_BR'),
      response,
    )

    expect(deps.enqueueTemplateSend.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ templateName: 'pesquisa' }),
    )
  })

  it('recusa contagem de valores divergente', async () => {
    const deps = hubDeps()

    const result = await deps.controller.perform(
      templateRequest('João'),
      response,
    )

    expect(result.result).toMatchObject({ reason: 'parameter-count-mismatch' })
    expect(deps.enqueueTemplateSend.enqueue).not.toHaveBeenCalled()
  })

  /**
   * Sender de linha numa linha oficial é registro anterior ao provedor por template.
   * Recusa com motivo em vez de adivinhar o template pelo corpo.
   */
  it('recusa sender de linha apontando para linha oficial', async () => {
    const deps = hubDeps()

    const result = await deps.controller.perform(
      request({ message_body: 'Promoção até sexta' }),
      response,
    )

    expect(result.status).toBe(200)
    expect(result.result).toMatchObject({ reason: 'line-sender-on-official' })
    expect(deps.enqueueTemplateSend.enqueue).not.toHaveBeenCalled()
  })

  it('recusa antes de consultar o catálogo quando a linha não pode enviar template', async () => {
    const deps = hubDeps({
      resolveTarget: vi
        .fn()
        .mockRejectedValue(new Error('Canal não conectado')),
    })

    const result = await deps.controller.perform(
      templateRequest('João\n10/09'),
      response,
    )

    expect(result.result).toMatchObject({
      reason: 'line-cannot-send-template',
    })
    expect(deps.listTemplates.execute).not.toHaveBeenCalled()
  })
})

describe('idempotência por message_id', () => {
  it('não enfileira de novo e responde 200 no reenvio', async () => {
    const deps = makeDeps({ existingRow: { id: 'outbox-1' } })

    const result = await deps.controller.perform(request({}), response)

    expect(result.status).toBe(200)
    expect(result.result).toMatchObject({ duplicate: true })
    expect(deps.enqueueWidgetMessage.execute).not.toHaveBeenCalled()
  })

  it('enfileira os dois quando o telefone repete com message_id distinto', async () => {
    const deps = makeDeps()

    await deps.controller.perform(request({ message_id: 'msg-1' }), response)
    await deps.controller.perform(request({ message_id: 'msg-2' }), response)

    expect(deps.enqueueWidgetMessage.execute).toHaveBeenCalledTimes(2)
  })
})
