import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/clients/bitrix.client', () => {
  class BitrixClient {}
  return { BitrixClient }
})

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

import { SendWidgetMessageUseCase } from './send-widget-message.use-case'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { LineDisconnectedError } from '@/modules/thinkzap/domain/errors/line-disconnected.error'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

/**
 * O bloco anterior deste arquivo testava `sendToOpenChannel`, que **migrou** para
 * `status-callback.handler` — dois testes falhavam e dois passavam por acidente,
 * asseverando que um mock nunca chamado não era chamado. Cobertura morta trocada
 * pela do que o use case faz hoje: resolver a linha pelo item de assinatura.
 */
const zapiItem = (id = 'i1'): SubscriptionItem => ({
  id,
  name: 'Linha comercial',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: '10',
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'TOKEN-SECRETO',
  },
})

const hubItem = (): SubscriptionItem => ({
  ...zapiItem('i2'),
  metadata: {
    provider: 'HUBMESSAGE',
    hubmessageChannelId: 'C-9',
    wabaId: 'W-9',
  },
})

const baseInput = {
  subscriptionItemId: 'i1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  destination: '5511999999999',
  message: 'Olá',
  entity: 'deal',
  entityId: '42',
}

function makeSut(items: SubscriptionItem[] = [zapiItem()]) {
  const execute = vi.fn().mockResolvedValue({
    customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
    aplication: { id: 'installed-1', spaId: '42' },
    // `status` e janela obrigatórios: sem eles o entitlement cai em `inactive` e o
    // envio é recusado antes de resolver credencial.
    subscriptions: [
      {
        id: 'sub-1',
        status: 'active',
        currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
        items,
      },
    ],
  })
  const getInstanceByInstanceId = vi
    .fn()
    .mockResolvedValue({ id: 'inst-db-1', instanceId: 'Z-1' })
  const create = vi.fn().mockResolvedValue({ id: 'inst-nova' })

  const zApiClient = {
    getInstance: vi.fn().mockResolvedValue({ connected: true, token: 'tk' }),
    getPhoneData: vi.fn().mockResolvedValue({ phone: '5511911111111' }),
    sendMessage: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
    sendImage: vi.fn().mockResolvedValue({ messageId: 'msg-img' }),
  }
  const messageRepository = { create: vi.fn().mockResolvedValue(undefined) }
  const sendBitrixNotification = {
    execute: vi.fn().mockResolvedValue(undefined),
  }

  const useCase = new SendWidgetMessageUseCase(
    { execute } as never,
    { getInstanceByInstanceId, create } as never,
    zApiClient as never,
    sendBitrixNotification as never,
    messageRepository as never,
    new BitrixClient({} as never),
  )

  return {
    execute,
    getInstanceByInstanceId,
    create,
    zApiClient,
    messageRepository,
    sendBitrixNotification,
    send: (overrides: Partial<typeof baseInput> = {}) =>
      useCase.execute({ ...baseInput, ...overrides }),
  }
}

describe('SendWidgetMessageUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('envia com a credencial do item, não de Connector', async () => {
    const sut = makeSut()

    await sut.send()

    expect(sut.zApiClient.sendMessage).toHaveBeenCalledWith(
      'Z-1',
      'TOKEN-SECRETO',
      'Olá',
      '5511999999999',
    )
  })

  it('escopa a resolução pelo par (domainId, appCode) do token', async () => {
    const sut = makeSut()

    await sut.send()

    expect(sut.execute).toHaveBeenCalledWith({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
    })
  })

  /** A mensagem persistida tem FK para `Instance.id` — daí a âncora. */
  it('persiste a mensagem na âncora da linha', async () => {
    const sut = makeSut()

    await sut.send()

    expect(sut.messageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'inst-db-1', source: 'BITRIX' }),
    )
  })

  it('cria a âncora quando a linha não tem registro', async () => {
    const sut = makeSut()
    sut.getInstanceByInstanceId.mockResolvedValue(null)

    await sut.send()

    expect(sut.create).toHaveBeenCalled()
    expect(sut.messageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'inst-nova' }),
    )
  })

  it('rejeita item de outra instalação antes de tocar o provider', async () => {
    const sut = makeSut([zapiItem('outro')])

    await expect(sut.send()).rejects.toBeInstanceOf(LineNotFoundError)
    expect(sut.zApiClient.sendMessage).not.toHaveBeenCalled()
  })

  it('rejeita linha de provider não-Z-API', async () => {
    const sut = makeSut([hubItem()])

    await expect(sut.send({ subscriptionItemId: 'i2' })).rejects.toBeInstanceOf(
      LineProviderNotSupportedError,
    )
  })

  it('exige mensagem ou anexo', async () => {
    const sut = makeSut()

    await expect(sut.send({ message: '   ' })).rejects.toThrow(
      /Message or at least one attachment/,
    )
    expect(sut.execute).not.toHaveBeenCalled()
  })

  it('recusa telefone de destino inválido', async () => {
    const sut = makeSut()

    await expect(sut.send({ destination: '123' })).rejects.toThrow(
      /Invalid destination phone number/,
    )
    expect(sut.zApiClient.sendMessage).not.toHaveBeenCalled()
  })

  /**
   * A ordem é habilitação → conexão → provider, e a checagem vem antes de
   * `ensureLineInstance`: um envio recusado não pode deixar row de `Instance` para
   * trás nem gastar requisição de envio no provider.
   */
  describe('linha desconectada', () => {
    const disconnected = () => {
      const sut = makeSut()
      sut.zApiClient.getInstance.mockResolvedValue({ connected: false })
      return sut
    }

    it('recusa com LineDisconnectedError sem enviar texto', async () => {
      const sut = disconnected()

      await expect(sut.send()).rejects.toBeInstanceOf(LineDisconnectedError)
      expect(sut.zApiClient.sendMessage).not.toHaveBeenCalled()
    })

    it('recusa sem enviar anexo', async () => {
      const sut = disconnected()

      await expect(
        sut.send({
          message: undefined,
          attachments: [{ kind: 'image', content: 'data:image/png;base64,aa' }],
        } as never),
      ).rejects.toBeInstanceOf(LineDisconnectedError)
      expect(sut.zApiClient.sendImage).not.toHaveBeenCalled()
    })

    it('não grava mensagem nem notifica o Bitrix', async () => {
      const sut = disconnected()

      await expect(sut.send()).rejects.toBeInstanceOf(LineDisconnectedError)
      expect(sut.messageRepository.create).not.toHaveBeenCalled()
      expect(sut.sendBitrixNotification.execute).not.toHaveBeenCalled()
    })

    /** Antes de `ensureLineInstance` de propósito. */
    it('não cria a âncora de Instance', async () => {
      const sut = disconnected()
      sut.getInstanceByInstanceId.mockResolvedValue(null)

      await expect(sut.send()).rejects.toBeInstanceOf(LineDisconnectedError)
      expect(sut.create).not.toHaveBeenCalled()
    })
  })

  it('envia normalmente quando a linha está conectada', async () => {
    const sut = makeSut()

    await sut.send()

    expect(sut.zApiClient.getInstance).toHaveBeenCalledWith(
      'Z-1',
      'TOKEN-SECRETO',
    )
    expect(sut.zApiClient.sendMessage).toHaveBeenCalled()
    expect(sut.messageRepository.create).toHaveBeenCalled()
  })

  /**
   * Status indisponível não é desconexão: recusar por um blip do provider impediria
   * envio que teria funcionado.
   */
  it('prossegue quando a leitura de status falha', async () => {
    const sut = makeSut()
    sut.zApiClient.getInstance.mockRejectedValue(
      new Error('Failed to get instance data'),
    )

    await expect(sut.send()).resolves.toMatchObject({
      message: 'Message sent successfully',
    })
    expect(sut.zApiClient.sendMessage).toHaveBeenCalled()
  })
})
