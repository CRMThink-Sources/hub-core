import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createMock,
  findByBitrixMessageIdMock,
  sendMessageZApiMock,
  sendImageMock,
  sendVideoMock,
  sendAudioMock,
  sendDocumentMock,
  setMessageDeliveredMock,
  callMethodMock,
  getContextMock,
  ensureBitrixBotIdMock,
  sendHubMessageMock,
} = vi.hoisted(() => ({
  createMock: vi.fn().mockResolvedValue(undefined),
  findByBitrixMessageIdMock: vi.fn().mockResolvedValue(null),
  sendMessageZApiMock: vi.fn().mockResolvedValue({ messageId: 'ZAPI-1' }),
  sendImageMock: vi.fn().mockResolvedValue({ messageId: 'ZAPI-IMG' }),
  sendVideoMock: vi.fn().mockResolvedValue({ messageId: 'ZAPI-VID' }),
  sendAudioMock: vi.fn().mockResolvedValue({ messageId: 'ZAPI-AUD' }),
  sendDocumentMock: vi.fn().mockResolvedValue({ messageId: 'ZAPI-DOC' }),
  setMessageDeliveredMock: vi.fn().mockResolvedValue(undefined),
  callMethodMock: vi
    .fn()
    .mockResolvedValue({ result: { message: { params: {} } } }),
  getContextMock: vi.fn(),
  ensureBitrixBotIdMock: vi.fn().mockResolvedValue(1958),
  sendHubMessageMock: vi.fn().mockResolvedValue({ messageId: 'HM-1' }),
}))

vi.mock('@/modules/thinkzap/infra/clients/hubmessage.client', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/thinkzap/infra/clients/hubmessage.client')
  >('@/modules/thinkzap/infra/clients/hubmessage.client')
  return {
    // `HubMessageApiError` Ã© real: o classificador de janela fechada usa
    // `instanceof`, entÃ£o um mock de classe quebraria a detecÃ§Ã£o.
    HubMessageApiError: actual.HubMessageApiError,
    HubMessageClient: class {
      sendMessage = sendHubMessageMock
    },
  }
})

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository',
  () => ({
    PrismaThinkzapMessageRepository: class {
      create = createMock
      findByBitrixMessageId = findByBitrixMessageIdMock
    },
  }),
)

// O processor importa `redisConnection` no topo, e o mÃ³dulo lanÃ§a
// `REDIS_URL is required` no import quando a env nÃ£o existe (caso do teste).
vi.mock('@/queue/redis-connection', () => ({
  redisConnection: { get: vi.fn(), set: vi.fn() },
}))

vi.mock('@/modules/thinkzap/application/ensure-bitrix-bot-id', () => ({
  ensureBitrixBotId: ensureBitrixBotIdMock,
}))

vi.mock('@/modules/thinkzap/infra/clients/z-api.client', () => ({
  ZApiClient: class {
    sendMessage = sendMessageZApiMock
    sendImage = sendImageMock
    sendVideo = sendVideoMock
    sendAudio = sendAudioMock
    sendDocument = sendDocumentMock
  },
}))

vi.mock('@/shared/infra/clients/bitrix.client', () => ({
  BitrixClient: class {
    setMessageDelivered = setMessageDeliveredMock
    callMethod = callMethodMock
  },
}))

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-bitrix-webhook-context.repository',
  () => ({
    PrismaBitrixWebhookContextRepository: class {
      getContext = getContextMock
    },
  }),
)

vi.mock(
  '@/modules/thinkzap/infra/adapters/bitrix-get-user-display-name.adapter',
  () => ({
    BitrixGetUserDisplayNameAdapter: class {},
  }),
)

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-allowed-user.repository',
  () => ({
    PrismaAllowedUserRepository: class {},
  }),
)

vi.mock(
  '@/modules/thinkzap/application/prepare-open-line-outbound-text',
  () => ({
    prepareOpenLineOutboundText: vi.fn().mockResolvedValue('texto enviado'),
  }),
)

/**
 * A resoluÃ§Ã£o da linha pelo id de provider tem os prÃ³prios testes; aqui ela Ã©
 * dublada para o teste nÃ£o montar a Ã¡rvore de repositÃ³rios de billing (Prisma,
 * Redis e Bitrix) sÃ³ para decidir habilitaÃ§Ã£o e preparar o texto de saÃ­da.
 *
 * `resolveLineMock` Ã© exposto para os testes que precisam de linha bloqueada.
 */
const { resolveLineMock } = vi.hoisted(() => ({
  resolveLineMock: vi.fn(),
}))

vi.mock(
  '@/modules/thinkzap/application/helpers/resolve-settings-by-instance-id',
  () => ({
    findLineItemByInstanceId: resolveLineMock,
    findLineItemByChannelId: resolveLineMock,
    resolveSettingsByInstanceId: vi.fn().mockResolvedValue({
      prefixOperatorNameEnabled: false,
      widgetOpenChannelEnabled: false,
      messageUpdateEventEnabled: true,
      messageDeleteEventEnabled: true,
    }),
  }),
)

const ACTIVE_LINE = {
  item: { id: 'i1' },
  settings: {
    prefixOperatorNameEnabled: false,
    widgetOpenChannelEnabled: false,
    messageUpdateEventEnabled: true,
    messageDeleteEventEnabled: true,
  },
  entitlement: 'active' as const,
}

vi.mock('@/modules/application/main/make-get-aplication-context', () => ({
  makeGetAplicationContext: vi.fn(() => ({ execute: vi.fn() })),
}))

vi.mock('@/shared/app-catalog/app-catalog', () => ({
  resolveByMarketplaceCode: () => ({
    appCode: 'app-code-thinkzap',
    appCodeId: 'app-code-thinkzap',
    slug: 'thinkzap',
    requiresOperatorOAuth: true,
  }),
}))

vi.mock('@/config/env', () => ({
  env: {
    bitrix: { connector: { code: 'thinkzap' } },
    zApi: { partnerToken: 'pt', clientToken: 'ct' },
    hubMessage: {
      baseUrl: 'https://api.hubmessage.io',
      secretKey: 'sk-test',
      webhookUrl: 'https://app.test/webhooks/hubmessage',
    },
    appCodes: { thinkzap: 'thinkzap' },
    // O preparo do texto resolve `settings` pelo contexto da aplicaÃ§Ã£o, que lÃª as
    // SPAs de billing â€” sem isso a Ã¡rvore de repositÃ³rios nÃ£o monta no import.
    payments: {
      spa: {
        aplicationEntityType: 1060,
        productEntityType: 1134,
        planEntityType: 1138,
        subscriptionEntityType: 1142,
        subscriptionItemEntityType: 1146,
      },
    },
    crmthinkWebhookUrl: 'https://crmthink.test/rest/1/token/',
    logLevel: 'silent',
    nodeEnv: 'test',
  },
}))

vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: Buffer.from('audio') }),
    isAxiosError: vi.fn().mockReturnValue(false),
  },
}))

vi.mock('@/shared/helpers/convert-to-mp3', () => ({
  convertToMp3: vi.fn().mockResolvedValue(Buffer.from('mp3')),
}))

import { processBitrixReceivedMessage } from './bitrix-received-message.processor'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'

const baseContext = {
  name: 'acme.bitrix24.com',
  app: { id: 'app-1', credential: { id: 'cred-1' } },
  connector: { provider: 'ZAPI' },
  instance: {
    id: 'inst-db-1',
    instanceId: 'INST-A',
    zApiToken: 'token',
    channelId: null,
    settings: {},
  },
}

function makeEvent(
  messageOverride: Partial<IBX24MessageEvent['data']['MESSAGES'][number]> = {},
): IBX24MessageEvent {
  return {
    event: 'ONIMCONNECTORMESSAGEADD',
    event_handler_id: '1',
    ts: '1700000000',
    auth: {
      access_token: 'tok',
      expires: '',
      expires_in: '',
      scope: '',
      domain: 'acme.bitrix24.com',
      server_endpoint: '',
      status: '',
      client_endpoint: '',
      member_id: '',
      user_id: '1',
      application_token: '',
    },
    data: {
      CONNECTOR: 'thinkzap',
      LINE: '10',
      MESSAGES: [
        {
          im: { chat_id: '100', message_id: 'BITRIX-MSG-1' },
          message: { user_id: '1', text: 'Ola', files: undefined },
          chat: { id: '5511999999999' },
          ...messageOverride,
        } as IBX24MessageEvent['data']['MESSAGES'][number],
      ],
    },
  }
}

describe('processBitrixReceivedMessage DB persistence', () => {
  beforeEach(() => {
    resolveLineMock.mockReset().mockResolvedValue(ACTIVE_LINE)
    createMock.mockClear()
    createMock.mockResolvedValue(undefined)
    findByBitrixMessageIdMock.mockClear()
    findByBitrixMessageIdMock.mockResolvedValue(null)
    sendMessageZApiMock.mockClear()
    sendImageMock.mockClear()
    sendVideoMock.mockClear()
    sendAudioMock.mockClear()
    sendDocumentMock.mockClear()
    setMessageDeliveredMock.mockClear()
    callMethodMock.mockClear()
    callMethodMock.mockResolvedValue({ result: { message: { params: {} } } })
    ensureBitrixBotIdMock.mockClear()
    getContextMock.mockResolvedValue(baseContext)
  })

  /**
   * Recusa **visível**, não descarte: aqui existe um operador no Bitrix esperando a
   * mensagem sair. Lançar deixa o job falhar e o erro aparecer.
   */
  it('recusa o envio quando o trial venceu', async () => {
    resolveLineMock.mockResolvedValue({
      ...ACTIVE_LINE,
      entitlement: 'trial-expired',
    })

    await expect(processBitrixReceivedMessage(makeEvent())).rejects.toThrow(
      /not enabled/i,
    )

    expect(sendMessageZApiMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('recusa o envio quando a assinatura está cancelada', async () => {
    resolveLineMock.mockResolvedValue({
      ...ACTIVE_LINE,
      entitlement: 'inactive',
    })

    await expect(processBitrixReceivedMessage(makeEvent())).rejects.toThrow()
    expect(sendMessageZApiMock).not.toHaveBeenCalled()
  })

  /** Sem item resolvido não há assinatura que autorize o envio. */
  it('recusa o envio quando a linha não resolve item', async () => {
    resolveLineMock.mockResolvedValue(null)

    await expect(processBitrixReceivedMessage(makeEvent())).rejects.toThrow()
    expect(sendMessageZApiMock).not.toHaveBeenCalled()
  })

  it('persists text message with correct IDs', async () => {
    await processBitrixReceivedMessage(makeEvent())

    expect(sendMessageZApiMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'inst-db-1',
        source: 'BITRIX',
        providerMessageId: 'ZAPI-1',
        bitrixMessageId: 'BITRIX-MSG-1',
        type: 'TEXT',
        chatId: '5511999999999',
        // `im.chat_id`, nao o telefone: e o unico endereco para avisar o operador
        // quando o provider aceita e a Meta recusa depois (callback de status).
        bitrixChatId: '100',
      }),
    )
  })

  it('persists image message with correct type', async () => {
    await processBitrixReceivedMessage(
      makeEvent({
        message: {
          user_id: '1',
          text: '',
          files: [
            {
              name: 'photo.jpg',
              type: 'image',
              mime: 'image/jpeg',
              link: 'http://x/photo.jpg',
              downloadLink: 'http://x/photo.jpg',
              size: '1000',
              sizef: '1KB',
              width: 100,
              height: 100,
            },
          ],
        },
      }),
    )

    expect(sendImageMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'BITRIX',
        providerMessageId: 'ZAPI-IMG',
        bitrixMessageId: 'BITRIX-MSG-1',
        type: 'IMAGE',
      }),
    )
  })

  it('persists document message with fileName', async () => {
    await processBitrixReceivedMessage(
      makeEvent({
        message: {
          user_id: '1',
          text: '',
          files: [
            {
              name: 'contrato.pdf',
              type: 'file',
              mime: 'application/pdf',
              link: 'http://x/contrato.pdf',
              downloadLink: 'http://x/contrato.pdf',
              size: '5000',
              sizef: '5KB',
              width: 0,
              height: 0,
            },
          ],
        },
      }),
    )

    expect(sendDocumentMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'BITRIX',
        providerMessageId: 'ZAPI-DOC',
        bitrixMessageId: 'BITRIX-MSG-1',
        type: 'DOCUMENT',
        fileName: 'contrato.pdf',
      }),
    )
  })

  it('DB failure does not interrupt message send', async () => {
    createMock.mockRejectedValueOnce(new Error('db down'))

    await expect(
      processBitrixReceivedMessage(makeEvent()),
    ).resolves.toBeUndefined()

    expect(sendMessageZApiMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledTimes(1)
  })
})

const hubMessageContext = {
  ...baseContext,
  connector: { provider: 'HUBMESSAGE' },
  instance: { ...baseContext.instance, zApiToken: null, channelId: 'CH-123' },
}

describe('processBitrixReceivedMessage provider routing', () => {
  beforeEach(() => {
    resolveLineMock.mockReset().mockResolvedValue(ACTIVE_LINE)
    createMock.mockClear()
    createMock.mockResolvedValue(undefined)
    findByBitrixMessageIdMock.mockClear()
    findByBitrixMessageIdMock.mockResolvedValue(null)
    sendMessageZApiMock.mockClear()
    sendHubMessageMock.mockClear()
    sendHubMessageMock.mockResolvedValue({ messageId: 'HM-1' })
    setMessageDeliveredMock.mockClear()
    callMethodMock.mockClear()
    callMethodMock.mockResolvedValue({ result: { message: { params: {} } } })
  })

  it('conector HUBMESSAGE envia via HubMessage e nÃ£o toca no Z-API', async () => {
    getContextMock.mockResolvedValue(hubMessageContext)

    await processBitrixReceivedMessage(makeEvent())

    expect(sendHubMessageMock).toHaveBeenCalledWith('CH-123', {
      recipient: { identifier: '5511999999999' },
      content: { type: 'TEXT', body: { message: 'texto enviado' } },
    })
    expect(sendMessageZApiMock).not.toHaveBeenCalled()
  })

  it('conector HUBMESSAGE persiste providerMessageId e confirma entrega', async () => {
    getContextMock.mockResolvedValue(hubMessageContext)

    await processBitrixReceivedMessage(makeEvent())

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'BITRIX',
        providerMessageId: 'HM-1',
        bitrixMessageId: 'BITRIX-MSG-1',
        type: 'TEXT',
        // Sem isto o callback de status da HubMessage nao tem DIALOG_ID para avisar
        // o operador quando a Meta recusa a entrega depois do aceite.
        bitrixChatId: '100',
      }),
    )
    expect(setMessageDeliveredMock).toHaveBeenCalledTimes(1)
  })

  it('conector sem provider explÃ­cito roteia para Z-API', async () => {
    getContextMock.mockResolvedValue({
      ...baseContext,
      connector: { provider: 'ZAPI' },
    })

    await processBitrixReceivedMessage(makeEvent())

    expect(sendMessageZApiMock).toHaveBeenCalledTimes(1)
    expect(sendHubMessageMock).not.toHaveBeenCalled()
  })

  it('HUBMESSAGE nÃ£o resolve reply â€” nÃ£o consulta o banco por REPLY_ID', async () => {
    getContextMock.mockResolvedValue(hubMessageContext)
    callMethodMock.mockResolvedValue({
      result: { message: { params: { REPLY_ID: 'BX-MSG-42' } } },
    })

    await processBitrixReceivedMessage(makeEvent())

    expect(findByBitrixMessageIdMock).not.toHaveBeenCalled()
    expect(sendHubMessageMock).toHaveBeenCalledTimes(1)
  })

  it('ZAPI com REPLY_ID resolve a referÃªncia no banco', async () => {
    getContextMock.mockResolvedValue(baseContext)
    callMethodMock.mockResolvedValue({
      result: { message: { params: { REPLY_ID: 'BX-MSG-42' } } },
    })
    findByBitrixMessageIdMock.mockResolvedValue({
      providerMessageId: 'ZAPI-ANTERIOR',
    })

    await processBitrixReceivedMessage(makeEvent())

    expect(findByBitrixMessageIdMock).toHaveBeenCalledWith(
      'inst-db-1',
      'BX-MSG-42',
    )
    expect(sendMessageZApiMock).toHaveBeenCalledWith(
      'INST-A',
      'token',
      'texto enviado',
      '5511999999999',
      { referencedMessageId: 'ZAPI-ANTERIOR' },
    )
  })
})

describe('processBitrixReceivedMessage janela de 24h fechada', () => {
  beforeEach(() => {
    resolveLineMock.mockReset().mockResolvedValue(ACTIVE_LINE)
    createMock.mockClear()
    sendHubMessageMock.mockClear()
    setMessageDeliveredMock.mockClear()
    callMethodMock.mockClear()
    callMethodMock.mockResolvedValue({ result: { message: { params: {} } } })
    getContextMock.mockResolvedValue(hubMessageContext)
  })

  function makeWindowClosedError() {
    return new HubMessageApiError(
      422,
      'POST',
      '/v1/channels/CH-123/messages',
      { message: 'A janela de conversa de 24 horas estÃ¡ fechada' },
      null,
    )
  }

  it('nÃ£o persiste, nÃ£o confirma entrega e nÃ£o relanÃ§a', async () => {
    sendHubMessageMock.mockRejectedValue(makeWindowClosedError())

    await expect(
      processBitrixReceivedMessage(makeEvent()),
    ).resolves.toBeUndefined()

    expect(createMock).not.toHaveBeenCalled()
    expect(setMessageDeliveredMock).not.toHaveBeenCalled()
  })

  it('avisa o operador no chat via imbot.message.add', async () => {
    sendHubMessageMock.mockRejectedValue(makeWindowClosedError())

    await processBitrixReceivedMessage(makeEvent())

    expect(callMethodMock).toHaveBeenCalledWith(
      'imbot.message.add',
      expect.objectContaining({ BOT_ID: 1958, DIALOG_ID: 'chat100' }),
    )
  })

  it('falha por outro motivo relanÃ§a para a fila retentar', async () => {
    sendHubMessageMock.mockRejectedValue(
      new HubMessageApiError(500, 'POST', '/x', { message: 'boom' }, null),
    )

    await expect(processBitrixReceivedMessage(makeEvent())).rejects.toThrow()
    expect(createMock).not.toHaveBeenCalled()
  })
})

/**
 * A aba Logs do job e' o unico lugar onde quem abre UM job especifico ve o que
 * aconteceu com ELE. Estes testes travam as duas linhas que respondem "a mensagem nao
 * chegou": o aceite do provider (com o id para rastrear do lado dele) e a recusa.
 */
describe('processBitrixReceivedMessage aba Logs do job', () => {
  beforeEach(() => {
    resolveLineMock.mockReset().mockResolvedValue(ACTIVE_LINE)
    createMock.mockClear()
    createMock.mockResolvedValue(undefined)
    findByBitrixMessageIdMock.mockClear()
    findByBitrixMessageIdMock.mockResolvedValue(null)
    sendHubMessageMock.mockClear()
    sendHubMessageMock.mockResolvedValue({ messageId: 'HM-1' })
    setMessageDeliveredMock.mockClear()
    callMethodMock.mockClear()
    callMethodMock.mockResolvedValue({ result: { message: { params: {} } } })
    getContextMock.mockResolvedValue(hubMessageContext)
  })

  it('registra contexto, aceite do provider e confirmacao no Bitrix', async () => {
    const appendJobLog = vi.fn().mockResolvedValue(undefined)

    await processBitrixReceivedMessage(makeEvent(), { appendJobLog })

    const lines = appendJobLog.mock.calls.map(([line]) => line as string)

    expect(lines.some(l => l.includes('linha=10'))).toBe(true)
    expect(
      lines.some(
        l => l.includes('provider=HUBMESSAGE') && l.includes('CH-123'),
      ),
    ).toBe(true)
    // O id do provider e' o fim da nossa visibilidade: sem ele na aba, nao ha por
    // onde continuar a investigacao do lado da HubMessage.
    expect(lines.some(l => l.includes('providerMessageId=HM-1'))).toBe(true)
    expect(lines.some(l => l.includes('setMessageDelivered'))).toBe(true)
  })

  it('registra o status e o corpo da recusa do provider', async () => {
    const appendJobLog = vi.fn().mockResolvedValue(undefined)
    sendHubMessageMock.mockRejectedValue(
      new HubMessageApiError(500, 'POST', '/x', { message: 'boom' }, null),
    )

    await expect(
      processBitrixReceivedMessage(makeEvent(), { appendJobLog }),
    ).rejects.toThrow()

    const lines = appendJobLog.mock.calls.map(([line]) => line as string)

    expect(
      lines.some(l => l.includes('status 500') && l.includes('boom')),
    ).toBe(true)
    expect(lines.some(l => l.includes('providerMessageId'))).toBe(false)
  })
})

function makeFile(
  overrides: Partial<{
    name: string
    type: string
    mime: string
    downloadLink: string
  }> = {},
) {
  return {
    name: 'photo.jpg',
    type: 'image',
    mime: 'image/jpeg',
    link: 'http://x/photo.jpg',
    downloadLink: 'http://x/photo.jpg',
    size: '1000',
    sizef: '1KB',
    width: 100,
    height: 100,
    ...overrides,
  }
}

/**
 * Texto e anexo chegam no MESMO objeto de mensagem quando o operador anexa um
 * arquivo e escreve um comentário. O parse retornava no primeiro `if (text)` e o
 * anexo era descartado em silêncio — job `completed`, Bitrix confirmado, contato
 * sem o arquivo.
 */
describe('processBitrixReceivedMessage texto + anexo', () => {
  beforeEach(() => {
    resolveLineMock.mockReset().mockResolvedValue(ACTIVE_LINE)
    createMock.mockClear()
    createMock.mockResolvedValue(undefined)
    findByBitrixMessageIdMock.mockClear()
    findByBitrixMessageIdMock.mockResolvedValue(null)
    sendMessageZApiMock.mockClear()
    sendImageMock.mockClear()
    sendVideoMock.mockClear()
    sendAudioMock.mockClear()
    sendDocumentMock.mockClear()
    setMessageDeliveredMock.mockClear()
    callMethodMock.mockClear()
    callMethodMock.mockResolvedValue({ result: { message: { params: {} } } })
    getContextMock.mockResolvedValue(baseContext)
  })

  it('imagem com comentário sai como uma imagem legendada, sem envio de texto', async () => {
    await processBitrixReceivedMessage(
      makeEvent({
        message: {
          user_id: '1',
          text: 'Teste de imagem com texto',
          files: [makeFile()],
        },
      }),
    )

    expect(sendImageMock).toHaveBeenCalledTimes(1)
    expect(sendMessageZApiMock).not.toHaveBeenCalled()
    // A legenda passa pelo preparo do canal aberto, igual ao texto puro — o mock
    // de `prepareOpenLineOutboundText` devolve `texto enviado`.
    expect(sendImageMock).toHaveBeenCalledWith(
      'INST-A',
      'token',
      'http://x/photo.jpg',
      '5511999999999',
      expect.objectContaining({ caption: 'texto enviado' }),
    )
  })

  it('imagem legendada persiste type de mídia e o texto da legenda', async () => {
    await processBitrixReceivedMessage(
      makeEvent({
        message: {
          user_id: '1',
          text: 'Teste de imagem com texto',
          files: [makeFile()],
        },
      }),
    )

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'IMAGE',
        text: 'texto enviado',
        providerMessageId: 'ZAPI-IMG',
      }),
    )
  })

  it('imagem sem comentário continua sem legenda e sem texto persistido', async () => {
    await processBitrixReceivedMessage(
      makeEvent({
        message: { user_id: '1', text: '', files: [makeFile()] },
      }),
    )

    expect(sendImageMock.mock.calls[0]?.[4]).toEqual({ caption: undefined })
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'IMAGE', text: null }),
    )
  })

  it('documento com comentário vai com legenda', async () => {
    await processBitrixReceivedMessage(
      makeEvent({
        message: {
          user_id: '1',
          text: 'segue o contrato',
          files: [
            makeFile({
              name: 'contrato.pdf',
              type: 'file',
              mime: 'application/pdf',
              downloadLink: 'http://x/contrato.pdf',
            }),
          ],
        },
      }),
    )

    expect(sendDocumentMock).toHaveBeenCalledWith(
      'INST-A',
      'token',
      'http://x/contrato.pdf',
      '5511999999999',
      'contrato.pdf',
      expect.objectContaining({ caption: 'texto enviado' }),
    )
    expect(sendMessageZApiMock).not.toHaveBeenCalled()
  })

  /** Áudio não tem campo de legenda no WhatsApp: o texto sai como mensagem própria. */
  it('áudio com comentário sai em dois envios, texto primeiro', async () => {
    const order: string[] = []
    sendMessageZApiMock.mockImplementation(() => {
      order.push('text')
      return Promise.resolve({ messageId: 'ZAPI-1' })
    })
    sendAudioMock.mockImplementation(() => {
      order.push('audio')
      return Promise.resolve({ messageId: 'ZAPI-AUD' })
    })

    await processBitrixReceivedMessage(
      makeEvent({
        message: {
          user_id: '1',
          text: 'ouça isso',
          files: [
            makeFile({
              name: 'audio-1.ogg',
              type: 'audio',
              mime: 'audio/ogg',
              downloadLink: 'http://x/audio-1.ogg',
            }),
          ],
        },
      }),
    )

    expect(order).toEqual(['text', 'audio'])
  })

  it('dois anexos com um texto: legenda só no primeiro', async () => {
    await processBitrixReceivedMessage(
      makeEvent({
        message: {
          user_id: '1',
          text: 'duas fotos',
          files: [
            makeFile({ name: 'a.jpg', downloadLink: 'http://x/a.jpg' }),
            makeFile({ name: 'b.jpg', downloadLink: 'http://x/b.jpg' }),
          ],
        },
      }),
    )

    expect(sendImageMock).toHaveBeenCalledTimes(2)
    expect(sendImageMock.mock.calls[0]?.[4]).toEqual({
      caption: 'texto enviado',
    })
    expect(sendImageMock.mock.calls[1]?.[4]).toEqual({ caption: undefined })
  })

  /** Anexo descartado no parse não pode levar o comentário do operador embora. */
  it('texto com anexo de tipo desconhecido ainda envia o texto', async () => {
    await processBitrixReceivedMessage(
      makeEvent({
        message: {
          user_id: '1',
          text: 'olha esse arquivo',
          files: [makeFile({ type: 'unknown', name: 'x.bin' })],
        },
      }),
    )

    expect(sendMessageZApiMock).toHaveBeenCalledTimes(1)
    expect(sendImageMock).not.toHaveBeenCalled()
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TEXT' }),
    )
  })

  it('só texto continua um único envio de texto', async () => {
    await processBitrixReceivedMessage(makeEvent())

    expect(sendMessageZApiMock).toHaveBeenCalledTimes(1)
    expect(sendImageMock).not.toHaveBeenCalled()
  })

  it('aba Logs distingue mídia legendada de envio só de texto', async () => {
    const appendJobLog = vi.fn().mockResolvedValue(undefined)

    await processBitrixReceivedMessage(
      makeEvent({
        message: {
          user_id: '1',
          text: 'Teste de imagem com texto',
          files: [makeFile()],
        },
      }),
      { appendJobLog },
    )

    const lines = appendJobLog.mock.calls.map(([line]) => line as string)

    expect(
      lines.some(
        l => l.includes('Conteúdo a enviar') && l.includes('image com legenda'),
      ),
    ).toBe(true)
  })
})
