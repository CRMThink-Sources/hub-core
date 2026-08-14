import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: {
    bitrix: { connector: { code: 'hubthink_thinkzap' } },
    zApi: { partnerToken: 'pt', clientToken: 'ct' },
    logLevel: 'silent',
    nodeEnv: 'test',
  },
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import {
  ChannelNotConnectedError,
  ConnectorNotTemplateCapableError,
  TemplateSendNotSupportedError,
} from '@/modules/thinkzap/domain/ports/template-errors'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { SendWidgetTemplateUseCase } from './send-widget-template.use-case'

const hubItem = (
  overrides: Partial<SubscriptionItem> = {},
): SubscriptionItem => ({
  id: 'i1',
  name: 'Linha oficial',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: '10',
  metadata: {
    provider: 'HUBMESSAGE',
    hubmessageChannelId: 'C-9',
    wabaId: 'W-9',
  },
  ...overrides,
})

const zapiItem = (): SubscriptionItem =>
  hubItem({
    id: 'i_zapi',
    metadata: {
      provider: 'ZAPI',
      zApiInstanceId: 'Z-1',
      zApiInstanceToken: 'TOKEN-SECRETO',
    },
  })

const baseInput = {
  subscriptionItemId: 'i1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  destination: '5511999999999',
  templateName: 'order_update',
  language: 'pt_BR',
  bodyParameters: ['Maria', '1234'],
  templateBody: 'Olá {{1}}, pedido {{2}} saiu.',
  entity: 'deal',
  entityId: '42',
}

function makeSut(
  options: {
    items?: SubscriptionItem[]
    subscriptionStatus?: string
    currentPeriodEnd?: Date
    send?: ReturnType<typeof vi.fn>
    resolve?: ReturnType<typeof vi.fn>
  } = {},
) {
  const execute = vi.fn().mockResolvedValue({
    customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
    aplication: { id: 'installed-1', spaId: '42' },
    subscriptions: [
      {
        id: 'sub-1',
        status: options.subscriptionStatus ?? 'active',
        currentPeriodEnd:
          options.currentPeriodEnd ?? new Date('2099-01-01T00:00:00.000Z'),
        items: options.items ?? [hubItem()],
      },
    ],
  })

  const getInstanceByChannelId = vi
    .fn()
    .mockResolvedValue({ id: 'inst-db-1', instanceId: 'C-9' })
  const create = vi.fn().mockResolvedValue({ id: 'inst-nova' })

  const send = options.send ?? vi.fn().mockResolvedValue({ messageId: 'msg-1' })
  const resolve =
    options.resolve ??
    vi.fn().mockReturnValue({ supportsTemplateSend: true, send })

  const messageRepository = { create: vi.fn().mockResolvedValue(undefined) }
  const sendBitrixNotification = {
    execute: vi.fn().mockResolvedValue(undefined),
  }

  const openChannelQueue = {
    enqueue: vi.fn().mockResolvedValue(undefined),
  }

  const useCase = new SendWidgetTemplateUseCase(
    { execute } as never,
    { getInstanceByChannelId, create } as never,
    { resolve } as never,
    sendBitrixNotification as never,
    messageRepository as never,
    openChannelQueue as never,
  )

  return {
    execute,
    getInstanceByChannelId,
    create,
    resolve,
    send,
    messageRepository,
    sendBitrixNotification,
    openChannelQueue,
    sendTemplate: (overrides: Partial<typeof baseInput> = {}) =>
      useCase.execute({ ...baseInput, ...overrides }),
  }
}

/** A linha oficial do relato: canal vinculado no item e toggle ligado. */
const openChannelHubItem = (): SubscriptionItem =>
  hubItem({
    settings: { ...DEFAULT_CONNECTOR_SETTINGS, widgetOpenChannelEnabled: true },
  })

/**
 * O job de abertura de conversa que foi enfileirado — `mock.calls` é `any`.
 *
 * Identificadores, não o item resolvido: o worker relê o contexto no momento de
 * postar.
 */
type OpenChannelCall = {
  subscriptionItemId: string
  domainId: string
  appCode: string
  instanceId: string
  providerMessageId: string
  destination: string
  text: string
}

const openChannelCall = (
  sut: { openChannelQueue: { enqueue: ReturnType<typeof vi.fn> } },
  index = 0,
): OpenChannelCall =>
  sut.openChannelQueue.enqueue.mock.calls[index]?.[0] as OpenChannelCall

describe('SendWidgetTemplateUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('envia o template pelo canal da linha, com o destino normalizado', async () => {
    const sut = makeSut()

    const result = await sut.sendTemplate()

    expect(sut.resolve).toHaveBeenCalledWith('HUBMESSAGE', {
      channelId: 'C-9',
      recipientIdentifier: '5511999999999',
    })
    expect(sut.send).toHaveBeenCalledWith({
      templateName: 'order_update',
      language: 'pt_BR',
      bodyParameters: ['Maria', '1234'],
    })
    expect(result.sentMessageId).toBe('msg-1')
  })

  it('escopa a resolução pelo par (domainId, appCode) do token', async () => {
    const sut = makeSut()

    await sut.sendTemplate()

    expect(sut.execute).toHaveBeenCalledWith({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
    })
  })

  it('persiste o corpo resolvido na âncora da linha', async () => {
    const sut = makeSut()

    await sut.sendTemplate()

    expect(sut.messageRepository.create).toHaveBeenCalledWith({
      instanceId: 'inst-db-1',
      source: 'BITRIX',
      providerMessageId: 'msg-1',
      type: 'TEXT',
      text: 'Olá Maria, pedido 1234 saiu.',
    })
  })

  it('cria a âncora quando a linha oficial não tem registro', async () => {
    const sut = makeSut()
    sut.getInstanceByChannelId.mockResolvedValue(null)

    await sut.sendTemplate()

    expect(sut.create).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: 'C-9', wabaId: 'W-9' }),
    )
  })

  it('notifica no Bitrix com o texto que o contato recebeu', async () => {
    const sut = makeSut()

    await sut.sendTemplate()

    expect(sut.sendBitrixNotification.execute).toHaveBeenCalledWith({
      contextId: '42',
      entity: 'deal',
      message:
        'Para: 5511999999999\nTemplate: order_update\nMensagem: Olá Maria, pedido 1234 saiu.',
    })
  })

  it('recusa linha bloqueada antes de resolver o sender', async () => {
    const sut = makeSut({
      subscriptionStatus: 'past_due',
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
    })

    await expect(sut.sendTemplate()).rejects.toBeInstanceOf(LineBlockedError)
    expect(sut.resolve).not.toHaveBeenCalled()
    expect(sut.send).not.toHaveBeenCalled()
  })

  it('recusa linha Z-API por capacidade, sem tocar o provider', async () => {
    const sut = makeSut({ items: [zapiItem()] })

    await expect(
      sut.sendTemplate({ subscriptionItemId: 'i_zapi' }),
    ).rejects.toBeInstanceOf(ConnectorNotTemplateCapableError)
    expect(sut.resolve).not.toHaveBeenCalled()
  })

  it('recusa linha oficial sem wabaId com erro de canal não conectado', async () => {
    const sut = makeSut({
      items: [
        hubItem({
          metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'C-9' },
        }),
      ],
    })

    await expect(sut.sendTemplate()).rejects.toBeInstanceOf(
      ChannelNotConnectedError,
    )
    expect(sut.resolve).not.toHaveBeenCalled()
  })

  it('erro quando a linha não está na instalação do token', async () => {
    const sut = makeSut()

    await expect(
      sut.sendTemplate({ subscriptionItemId: 'de-outro' }),
    ).rejects.toBeInstanceOf(LineNotFoundError)
  })

  it('recusa destino inválido antes de chamar o provider', async () => {
    const sut = makeSut()

    await expect(sut.sendTemplate({ destination: 'abc' })).rejects.toThrow(
      'Invalid destination phone number',
    )
    expect(sut.resolve).not.toHaveBeenCalled()
  })

  it('recusa do provider não persiste nem notifica', async () => {
    const sut = makeSut({
      send: vi.fn().mockRejectedValue(new Error('template not found')),
    })

    await expect(sut.sendTemplate()).rejects.toThrow('template not found')
    expect(sut.messageRepository.create).not.toHaveBeenCalled()
    expect(sut.sendBitrixNotification.execute).not.toHaveBeenCalled()
    expect(sut.create).not.toHaveBeenCalled()
  })

  it('propaga a recusa por provider sem suporte a envio de template', async () => {
    const sut = makeSut({
      resolve: vi.fn().mockImplementation(() => {
        throw new TemplateSendNotSupportedError('ZAPI')
      }),
    })

    await expect(sut.sendTemplate()).rejects.toBeInstanceOf(
      TemplateSendNotSupportedError,
    )
    expect(sut.messageRepository.create).not.toHaveBeenCalled()
  })

  /**
   * A linha do WhatsApp Oficial passa pela **mesma fila** do envio livre: abrir a
   * conversa é operação Bitrix, idêntica nos dois providers. Enquanto a abertura vivia
   * no callback de status da Z-API, esta linha não tinha bridge nenhum.
   */
  describe('conversa no canal aberto', () => {
    it('enfileira com o corpo resolvido do template', async () => {
      const sut = makeSut({ items: [openChannelHubItem()] })

      await sut.sendTemplate()

      const call = openChannelCall(sut)
      expect(call.subscriptionItemId).toBe('i1')
      expect(call.domainId).toBe('domain-1')
      expect(call.appCode).toBe('crmthink.thinkzap')
      expect(call.instanceId).toBe('inst-db-1')
      expect(call.providerMessageId).toBe('msg-1')
      expect(call.destination).toBe('5511999999999')
      expect(call.text).toBe('Olá Maria, pedido 1234 saiu.')
    })

    it('não posta o template cru com placeholders', async () => {
      const sut = makeSut({ items: [openChannelHubItem()] })

      await sut.sendTemplate()

      expect(openChannelCall(sut).text).not.toContain('{{1}}')
    })

    /** O toggle é decidido no worker, com o estado atual da linha. */
    it('enfileira mesmo com o toggle desligado', async () => {
      const sut = makeSut()

      await sut.sendTemplate()

      expect(sut.openChannelQueue.enqueue).toHaveBeenCalledTimes(1)
    })

    /**
     * O template já está no telefone do contato — e template costuma ser cobrado
     * pela Meta. Um erro que subisse faria o operador reenviar e pagar de novo.
     */
    it('falha ao enfileirar não impede o sucesso do envio', async () => {
      const sut = makeSut({ items: [openChannelHubItem()] })
      sut.openChannelQueue.enqueue.mockRejectedValue(new Error('redis down'))

      await expect(sut.sendTemplate()).resolves.toMatchObject({
        message: 'Template sent successfully',
      })
      expect(sut.sendBitrixNotification.execute).toHaveBeenCalled()
    })
  })
})
