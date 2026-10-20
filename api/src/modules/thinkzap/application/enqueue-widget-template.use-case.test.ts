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
import { EnqueueWidgetTemplateUseCase } from './enqueue-widget-template.use-case'
import type { SendWidgetTemplateInput } from './send-widget-template.types'

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

/** A row de outbox como o repositório a devolve — só o `id` importa aqui. */
const createdRow = { id: 'outbox-1' }

function makeSut(
  options: {
    items?: SubscriptionItem[]
    subscriptionStatus?: string
    currentPeriodEnd?: Date
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

  const resolve =
    options.resolve ??
    vi.fn().mockReturnValue({ supportsTemplateSend: true, send: vi.fn() })

  const outbox = { create: vi.fn().mockResolvedValue(createdRow) }
  const sendQueue = { enqueue: vi.fn().mockResolvedValue(undefined) }

  const useCase = new EnqueueWidgetTemplateUseCase(
    { execute } as never,
    { getInstanceByChannelId, create } as never,
    { resolve } as never,
    outbox as never,
    sendQueue,
  )

  return {
    execute,
    getInstanceByChannelId,
    create,
    resolve,
    outbox,
    sendQueue,
    enqueueTemplate: (overrides: Partial<SendWidgetTemplateInput> = {}) =>
      useCase.execute({ ...baseInput, ...overrides }),
  }
}

/** A intenção gravada — `mock.calls` é `any`. */
const outboxCall = (sut: {
  outbox: { create: ReturnType<typeof vi.fn> }
}): Record<string, unknown> =>
  sut.outbox.create.mock.calls[0]?.[0] as Record<string, unknown>

describe('EnqueueWidgetTemplateUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  /**
   * O par (template, parâmetros) vai gravado porque é o que o provider recebe; o corpo
   * resolvido vai em `text` porque é o que o histórico, o canal aberto e o aviso de
   * falha precisam ler — e o resolvido não tem volta.
   */
  it('grava a intenção como TEMPLATE, com o par e o corpo resolvido', async () => {
    const sut = makeSut()

    await sut.enqueueTemplate()

    expect(outboxCall(sut)).toMatchObject({
      kind: 'TEMPLATE',
      instanceId: 'inst-db-1',
      subscriptionItemId: 'i1',
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
      destination: '5511999999999',
      text: 'Olá Maria, pedido 1234 saiu.',
      templateName: 'order_update',
      templateLanguage: 'pt_BR',
      templateParameters: ['Maria', '1234'],
      entity: 'deal',
      entityId: '42',
    })
  })

  it('grava os valores dos botões dinâmicos com o index do catálogo', async () => {
    const sut = makeSut()
    const buttonParameters = [
      { index: 1, subType: 'URL' as const, value: 'PED-1' },
    ]

    await sut.enqueueTemplate({ buttonParameters })

    expect(outboxCall(sut)).toMatchObject({
      templateButtonParameters: buttonParameters,
    })
  })

  it('grava a URL da imagem do cabeçalho, e nulo quando não vem imagem', async () => {
    const withImage = makeSut()
    await withImage.enqueueTemplate({
      headerImageUrl: 'https://loja.com/promo.jpg',
    })
    expect(outboxCall(withImage).templateHeaderImageUrl).toBe(
      'https://loja.com/promo.jpg',
    )

    const withoutImage = makeSut()
    await withoutImage.enqueueTemplate()
    expect(outboxCall(withoutImage).templateHeaderImageUrl).toBeNull()
  })

  it('grava lista vazia de botões quando o envio não traz nenhum', async () => {
    const sut = makeSut()

    await sut.enqueueTemplate()

    expect(outboxCall(sut)).toMatchObject({ templateButtonParameters: [] })
  })

  it('grava o operador que disparou, e nulo quando não vem operador', async () => {
    const withOperator = makeSut()
    await withOperator.enqueueTemplate({ operatorBitrixUserId: '7' })
    expect(outboxCall(withOperator).operatorBitrixUserId).toBe('7')

    const robot = makeSut()
    await robot.enqueueTemplate()
    expect(outboxCall(robot).operatorBitrixUserId).toBeNull()
  })

  it('não grava o template cru com placeholders', async () => {
    const sut = makeSut()

    await sut.enqueueTemplate()

    expect(outboxCall(sut).text).not.toContain('{{1}}')
  })

  it('responde queued com o corpo resolvido, sem id do provider', async () => {
    const sut = makeSut()

    const result = await sut.enqueueTemplate()

    expect(result.status).toBe('queued')
    expect(result.destination).toBe('5511999999999')
    expect(result.sentText).toBe('Olá Maria, pedido 1234 saiu.')
    expect(result.clientMessageId).toEqual(expect.any(String))
  })

  /**
   * A ordem é o que impede a mensagem de sumir: com a row comitada, um Redis fora deixa
   * a intenção `PENDING` e recuperável em vez de perdida.
   */
  it('enfileira o job pelo id da row, depois de gravá-la', async () => {
    const sut = makeSut()

    await sut.enqueueTemplate()

    expect(sut.sendQueue.enqueue).toHaveBeenCalledWith({ outboxId: 'outbox-1' })
    expect(Number(sut.outbox.create.mock.invocationCallOrder[0])).toBeLessThan(
      Number(sut.sendQueue.enqueue.mock.invocationCallOrder[0]),
    )
  })

  it('escopa a resolução pelo par (domainId, appCode) do token', async () => {
    const sut = makeSut()

    await sut.enqueueTemplate()

    expect(sut.execute).toHaveBeenCalledWith({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
    })
  })

  it('cria a âncora quando a linha oficial não tem registro', async () => {
    const sut = makeSut()
    sut.getInstanceByChannelId.mockResolvedValue(null)

    await sut.enqueueTemplate()

    expect(sut.create).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: 'C-9', wabaId: 'W-9' }),
    )
  })

  /**
   * As recusas que o operador conserta continuam síncronas: retentativa não melhora
   * nenhuma delas, e transformá-las em falha assíncrona tiraria da tela exatamente os
   * erros acionáveis. Nenhuma pode deixar row de outbox para trás.
   */
  describe('recusas síncronas', () => {
    it('recusa linha bloqueada sem gravar nem enfileirar', async () => {
      const sut = makeSut({
        subscriptionStatus: 'past_due',
        currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
      })

      await expect(sut.enqueueTemplate()).rejects.toBeInstanceOf(
        LineBlockedError,
      )
      expect(sut.outbox.create).not.toHaveBeenCalled()
      expect(sut.sendQueue.enqueue).not.toHaveBeenCalled()
    })

    it('recusa linha Z-API por capacidade, sem tocar o provider', async () => {
      const sut = makeSut({ items: [zapiItem()] })

      await expect(
        sut.enqueueTemplate({ subscriptionItemId: 'i_zapi' }),
      ).rejects.toBeInstanceOf(ConnectorNotTemplateCapableError)
      expect(sut.resolve).not.toHaveBeenCalled()
      expect(sut.outbox.create).not.toHaveBeenCalled()
    })

    it('recusa linha oficial sem wabaId com erro de canal não conectado', async () => {
      const sut = makeSut({
        items: [
          hubItem({
            metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'C-9' },
          }),
        ],
      })

      await expect(sut.enqueueTemplate()).rejects.toBeInstanceOf(
        ChannelNotConnectedError,
      )
      expect(sut.outbox.create).not.toHaveBeenCalled()
    })

    it('erro quando a linha não está na instalação do token', async () => {
      const sut = makeSut()

      await expect(
        sut.enqueueTemplate({ subscriptionItemId: 'de-outro' }),
      ).rejects.toBeInstanceOf(LineNotFoundError)
    })

    it('recusa destino inválido antes de resolver o sender', async () => {
      const sut = makeSut()

      await expect(sut.enqueueTemplate({ destination: 'abc' })).rejects.toThrow(
        'Invalid destination phone number',
      )
      expect(sut.resolve).not.toHaveBeenCalled()
      expect(sut.outbox.create).not.toHaveBeenCalled()
    })

    /**
     * Sem esta recusa, uma instalação sem `HUBMESSAGE_SECRET_KEY` aceitaria o envio com
     * `202` e o operador só descobriria pelo aviso na timeline, três tentativas depois.
     * O resolver decide isso sem nenhuma chamada remota.
     */
    it('recusa provider sem envio de template configurado, sem gravar', async () => {
      const sut = makeSut({
        resolve: vi.fn().mockImplementation(() => {
          throw new TemplateSendNotSupportedError('HUBMESSAGE')
        }),
      })

      await expect(sut.enqueueTemplate()).rejects.toBeInstanceOf(
        TemplateSendNotSupportedError,
      )
      expect(sut.outbox.create).not.toHaveBeenCalled()
      expect(sut.sendQueue.enqueue).not.toHaveBeenCalled()
    })

    it('não envia nada no request — o sender é resolvido e descartado', async () => {
      const send = vi.fn()
      const sut = makeSut({
        resolve: vi.fn().mockReturnValue({ supportsTemplateSend: true, send }),
      })

      await sut.enqueueTemplate()

      expect(sut.resolve).toHaveBeenCalledWith('HUBMESSAGE', {
        channelId: 'C-9',
        recipientIdentifier: '5511999999999',
      })
      expect(send).not.toHaveBeenCalled()
    })
  })
})
