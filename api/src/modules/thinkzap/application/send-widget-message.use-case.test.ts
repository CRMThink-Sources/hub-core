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

import { SendWidgetMessageUseCase } from './send-widget-message.use-case'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { LineDisconnectedError } from '@/modules/thinkzap/domain/errors/line-disconnected.error'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { SendWidgetMessageInput } from './send-widget-message.types'
import type { DailySendQuota } from '@/modules/thinkzap/domain/ports/daily-send-quota.port'

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

/** A linha do relato do QA: canal vinculado no item e toggle ligado. */
const openChannelItem = (id = 'i1'): SubscriptionItem => ({
  ...zapiItem(id),
  settings: { ...DEFAULT_CONNECTOR_SETTINGS, widgetOpenChannelEnabled: true },
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

/**
 * O job de abertura de conversa que foi enfileirado — `mock.calls` é `any`.
 *
 * O payload leva **identificadores**, não o item resolvido: o worker relê o contexto
 * na hora de processar. Serializar o item no job congelaria canal e toggle no momento
 * do envio, e uma linha desvinculada entre o envio e o processamento continuaria
 * postando no canal antigo.
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

function makeSut(
  items: SubscriptionItem[] = [zapiItem()],
  quota: DailySendQuota | null = null,
  locale: 'pt' | 'en' | 'es' | null = null,
) {
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
    sendVideo: vi.fn().mockResolvedValue({ messageId: 'msg-vid' }),
    sendAudio: vi.fn().mockResolvedValue({ messageId: 'msg-aud' }),
    sendDocument: vi.fn().mockResolvedValue({ messageId: 'msg-doc' }),
  }
  const messageRepository = { create: vi.fn().mockResolvedValue(undefined) }
  const sendBitrixNotification = {
    execute: vi.fn().mockResolvedValue(undefined),
  }
  const openChannelQueue = {
    enqueue: vi.fn().mockResolvedValue(undefined),
  }

  /** Substitui o preparo real: prefixa quando a linha pede, como ele faria. */
  const prepareOutboundText = vi.fn(
    (input: {
      text: string
      settings: { prefixOperatorNameEnabled: boolean }
    }) =>
      Promise.resolve(
        input.settings.prefixOperatorNameEnabled
          ? `João Vitor: ${input.text}`
          : input.text,
      ),
  )

  const useCase = new SendWidgetMessageUseCase(
    { execute } as never,
    { getInstanceByInstanceId, create } as never,
    zApiClient as never,
    sendBitrixNotification as never,
    messageRepository as never,
    openChannelQueue as never,
    prepareOutboundText as never,
    quota,
    (locale ? { byAppId: vi.fn().mockResolvedValue(locale) } : null) as never,
  )

  return {
    execute,
    getInstanceByInstanceId,
    create,
    zApiClient,
    messageRepository,
    sendBitrixNotification,
    openChannelQueue,
    prepareOutboundText,
    send: (overrides: Partial<SendWidgetMessageInput> = {}) =>
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

  describe('prefixo de nome do operador', () => {
    const prefixItem = (): SubscriptionItem => ({
      ...zapiItem(),
      settings: {
        ...DEFAULT_CONNECTOR_SETTINGS,
        prefixOperatorNameEnabled: true,
      },
    })

    it('prefixa o texto que vai para o contato', async () => {
      const sut = makeSut([prefixItem()])

      await sut.send({ operatorBitrixUserId: '7' })

      expect(sut.zApiClient.sendMessage).toHaveBeenCalledWith(
        'Z-1',
        'TOKEN-SECRETO',
        'João Vitor: Olá',
        '5511999999999',
      )
      const call = sut.prepareOutboundText.mock.calls[0]?.[0]
      expect(call?.text).toBe('Olá')
      expect(call?.settings.prefixOperatorNameEnabled).toBe(true)
      expect(sut.prepareOutboundText).toHaveBeenCalledWith(
        expect.objectContaining({ operatorUserId: '7', appId: 'installed-1' }),
      )
    })

    /**
     * O registro interno guarda o que o operador digitou: histórico, espelho no canal
     * aberto e comentário de timeline saem daqui, e nos três o autor já é conhecido.
     */
    it('mantém o texto cru no histórico e no canal aberto', async () => {
      const sut = makeSut([
        {
          ...prefixItem(),
          settings: {
            ...DEFAULT_CONNECTOR_SETTINGS,
            prefixOperatorNameEnabled: true,
            widgetOpenChannelEnabled: true,
          },
        },
      ])

      await sut.send({ operatorBitrixUserId: '7' })

      expect(sut.messageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Olá' }),
      )
      expect(openChannelCall(sut).text).toBe('Olá')
    })

    it('entrega o texto cru quando o toggle está desligado', async () => {
      const sut = makeSut()

      await sut.send({ operatorBitrixUserId: '7' })

      expect(sut.zApiClient.sendMessage).toHaveBeenCalledWith(
        'Z-1',
        'TOKEN-SECRETO',
        'Olá',
        '5511999999999',
      )
    })
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

  /**
   * A abertura da conversa é enfileirada, não executada aqui. Ganha retentativa —
   * Bitrix fora por trinta segundos deixava a conversa sem abrir e ninguém tentava de
   * novo — e é seguro retentar porque a abertura é idempotente pelo `chat_id`.
   */
  describe('conversa no canal aberto', () => {
    it('enfileira uma vez, com os identificadores que o worker precisa', async () => {
      const sut = makeSut([openChannelItem()])

      await sut.send()

      expect(sut.openChannelQueue.enqueue).toHaveBeenCalledTimes(1)

      const call = openChannelCall(sut)
      expect(call.subscriptionItemId).toBe('i1')
      expect(call.domainId).toBe('domain-1')
      expect(call.appCode).toBe('crmthink.thinkzap')
      expect(call.instanceId).toBe('inst-db-1')
      expect(call.providerMessageId).toBe('msg-1')
      expect(call.destination).toBe('5511999999999')
      expect(call.text).toBe('Olá')
    })

    /** O item não vai no payload: canal e toggle são relidos no worker. */
    it('não serializa o item no job', async () => {
      const sut = makeSut([openChannelItem()])

      await sut.send()

      expect(openChannelCall(sut)).not.toHaveProperty('item')
    })

    /** O caso que produzia `"[Mensagem enviada a partir do CRM]\nnull"` no chat. */
    it('usa o descritivo do anexo quando não há texto', async () => {
      const sut = makeSut([openChannelItem()])

      await sut.send({
        message: undefined,
        attachments: [{ kind: 'video', content: 'data:video/mp4;base64,aa' }],
      } as never)

      expect(sut.openChannelQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          providerMessageId: 'msg-vid',
          text: '[Vídeo enviado]',
        }),
      )
    })

    it('ancora na primeira mensagem enviada quando há texto e anexos', async () => {
      const sut = makeSut([openChannelItem()])

      await sut.send({
        attachments: [
          { kind: 'image', content: 'data:image/png;base64,aa' },
          {
            kind: 'file',
            content: 'data:application/pdf;base64,bb',
            name: 'a.pdf',
          },
        ],
      } as never)

      expect(sut.openChannelQueue.enqueue).toHaveBeenCalledTimes(1)
      expect(sut.openChannelQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ providerMessageId: 'msg-1', text: 'Olá' }),
      )
    })

    /**
     * A mensagem já está no telefone do contato quando isto roda: Redis fora não pode
     * virar `500`, senão o operador reenvia e o contato recebe duas vezes.
     */
    it('falha ao enfileirar não derruba o envio', async () => {
      const sut = makeSut([openChannelItem()])
      sut.openChannelQueue.enqueue.mockRejectedValue(new Error('redis down'))

      await expect(sut.send()).resolves.toMatchObject({
        message: 'Message sent successfully',
      })
      expect(sut.sendBitrixNotification.execute).toHaveBeenCalled()
    })

    /**
     * O toggle é decidido no worker, não aqui — este use case enfileira mesmo com a
     * linha desligada. Filtrar antes duplicaria a regra em dois lugares, e o worker
     * lê o estado atual, que é o que vale no momento de postar.
     */
    it('enfileira mesmo com o toggle desligado — a decisão é do worker', async () => {
      const sut = makeSut()

      await sut.send()

      expect(sut.openChannelQueue.enqueue).toHaveBeenCalledTimes(1)
    })

    /** Sem texto nem anexo não há o que postar, então nem enfileira. */
    it('não enfileira quando não há texto para postar', async () => {
      const sut = makeSut([openChannelItem()])
      sut.zApiClient.sendMessage.mockResolvedValue({ messageId: undefined })

      await sut.send()

      expect(sut.openChannelQueue.enqueue).not.toHaveBeenCalled()
    })
  })

  /**
   * Uma row por mensagem aceita pelo provider, com o tipo real. O caminho antigo
   * gravava uma só, com o primeiro id e `type: 'TEXT'` fixo.
   */
  describe('persistência por mensagem enviada', () => {
    it('grava uma row por mensagem, com os tipos certos', async () => {
      const sut = makeSut()

      await sut.send({
        attachments: [
          { kind: 'image', content: 'data:image/png;base64,aa' },
          {
            kind: 'file',
            content: 'data:application/pdf;base64,bb',
            name: 'contrato.pdf',
          },
        ],
      } as never)

      expect(sut.messageRepository.create).toHaveBeenCalledTimes(3)
      expect(sut.messageRepository.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          providerMessageId: 'msg-1',
          type: 'TEXT',
          text: 'Olá',
          fileName: null,
        }),
      )
      expect(sut.messageRepository.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          providerMessageId: 'msg-img',
          type: 'IMAGE',
          text: null,
          fileName: null,
        }),
      )
      expect(sut.messageRepository.create).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          providerMessageId: 'msg-doc',
          type: 'DOCUMENT',
          text: null,
          fileName: 'contrato.pdf',
        }),
      )
    })

    it('devolve todos os ids enviados', async () => {
      const sut = makeSut()

      const result = await sut.send({
        attachments: [{ kind: 'video', content: 'data:video/mp4;base64,aa' }],
      } as never)

      expect(result).toMatchObject({ sentMessageIds: ['msg-1', 'msg-vid'] })
    })
  })
})

describe('SendWidgetMessageUseCase limite diário', () => {
  beforeEach(() => vi.clearAllMocks())

  const limitedItem = (): SubscriptionItem => ({
    ...zapiItem(),
    settings: {
      ...DEFAULT_CONNECTOR_SETTINGS,
      dailyLimitEnabled: true,
      dailyLimit: 2,
    },
  })

  const reserved = {
    status: 'reserved' as const,
    reservation: { release: vi.fn().mockResolvedValue(undefined) },
  }
  const refused = {
    status: 'refused' as const,
    counts: { sent: 2, extra: 0 },
    effectiveLimit: 2,
  }

  const quotaWith = (wouldRefuse: boolean, ...reserves: object[]) => {
    const reserve = vi.fn()
    for (const result of reserves) reserve.mockResolvedValueOnce(result)
    return {
      wouldRefuse: vi.fn().mockResolvedValue(wouldRefuse),
      reserve,
      addExtra: vi.fn(),
      usage: vi.fn(),
    }
  }

  it('limite já atingido: recusa sem enviar nada', async () => {
    const quota = quotaWith(true)
    const sut = makeSut([limitedItem()], quota as never)

    await expect(sut.send()).rejects.toMatchObject({
      errorCode: 'thinkzap.line.daily_limit_reached',
    })
    expect(sut.zApiClient.sendMessage).not.toHaveBeenCalled()
    expect(sut.messageRepository.create).not.toHaveBeenCalled()
  })

  it('cada parte conta: texto e anexo reservam uma vaga cada', async () => {
    const quota = quotaWith(false, reserved, reserved)
    const sut = makeSut([limitedItem()], quota as never)

    await sut.send({
      attachments: [{ kind: 'image', content: 'data:image/png;base64,aa' }],
    } as never)

    expect(quota.reserve).toHaveBeenCalledTimes(2)
    expect(quota.reserve).toHaveBeenCalledWith(
      { lineKey: 'Z-1', enabled: true, limit: 2 },
      expect.any(Date),
    )
  })

  it('limite acaba no meio: o que saiu é registrado e a timeline avisa os anexos não enviados', async () => {
    const quota = quotaWith(false, reserved, refused)
    const sut = makeSut([limitedItem()], quota as never)

    await expect(
      sut.send({
        attachments: [
          { kind: 'image', content: 'data:image/png;base64,aa' },
          { kind: 'video', content: 'data:video/mp4;base64,aa' },
        ],
      } as never),
    ).resolves.toBeDefined()

    expect(sut.zApiClient.sendMessage).toHaveBeenCalledTimes(1)
    expect(sut.zApiClient.sendImage).not.toHaveBeenCalled()
    expect(sut.zApiClient.sendVideo).not.toHaveBeenCalled()
    expect(sut.messageRepository.create).toHaveBeenCalledTimes(1)
    expect(sut.sendBitrixNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          '2 anexo(s) NÃO enviado(s)',
        ) as unknown,
      }),
    )
  })
})

describe('SendWidgetMessageUseCase limite diário (idioma)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('instalação em inglês: aviso de anexos não enviados em inglês', async () => {
    const quota = {
      wouldRefuse: vi.fn().mockResolvedValue(false),
      reserve: vi
        .fn()
        .mockResolvedValueOnce({
          status: 'reserved',
          reservation: { release: vi.fn() },
        })
        .mockResolvedValueOnce({
          status: 'refused',
          counts: { sent: 1, extra: 0 },
          effectiveLimit: 1,
        }),
    }
    const sut = makeSut([zapiItem()], quota as never, 'en')

    await sut.send({
      attachments: [{ kind: 'image', content: 'data:image/png;base64,aa' }],
    } as never)

    expect(sut.sendBitrixNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('1 attachment(s) NOT sent') as unknown,
      }),
    )
  })
})

describe('SendWidgetMessageUseCase timeline e histórico por idioma', () => {
  beforeEach(() => vi.clearAllMocks())

  it('comentário da timeline em inglês', async () => {
    const sut = makeSut([zapiItem()], null, 'en')

    await sut.send()

    const comment = (
      sut.sendBitrixNotification.execute.mock.calls[0]?.[0] as {
        message: string
      }
    ).message
    expect(comment).toBe('From: 5511911111111\nTo: 5511999999999\nMessage: Olá')
  })

  it('envio só com imagem: marcador do histórico em espanhol', async () => {
    const sut = makeSut([zapiItem()], null, 'es')

    await sut.send({
      message: '',
      attachments: [{ kind: 'image', content: 'data:image/png;base64,aa' }],
    } as never)

    expect(sut.openChannelQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ text: '[Imagen enviada]' }),
    )
  })

  it('sem idioma: comentário de hoje', async () => {
    const sut = makeSut()

    await sut.send()

    expect(sut.sendBitrixNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'De: 5511911111111\nPara: 5511999999999\nMensagem: Olá',
      }),
    )
  })
})
