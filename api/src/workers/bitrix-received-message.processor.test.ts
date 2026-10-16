import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createMock,
  findByBitrixMessageIdMock,
  sendMessageZApiMock,
  sendImageMock,
  sendVideoMock,
  sendAudioMock,
  sendDocumentMock,
  sendButtonActionsMock,
  setMessageDeliveredMock,
  callMethodMock,
  getContextMock,
  ensureBitrixBotIdMock,
  sendHubMessageMock,
  sendInteractiveActionMock,
  sendInteractiveButtonMock,
} = vi.hoisted(() => ({
  createMock: vi.fn().mockResolvedValue(undefined),
  findByBitrixMessageIdMock: vi.fn().mockResolvedValue(null),
  sendMessageZApiMock: vi.fn().mockResolvedValue({ messageId: 'ZAPI-1' }),
  sendImageMock: vi.fn().mockResolvedValue({ messageId: 'ZAPI-IMG' }),
  sendVideoMock: vi.fn().mockResolvedValue({ messageId: 'ZAPI-VID' }),
  sendAudioMock: vi.fn().mockResolvedValue({ messageId: 'ZAPI-AUD' }),
  sendDocumentMock: vi.fn().mockResolvedValue({ messageId: 'ZAPI-DOC' }),
  sendButtonActionsMock: vi
    .fn()
    .mockResolvedValue({ zaapId: 'z1', messageId: 'ZAPI-BTN', id: 'ZAPI-BTN' }),
  setMessageDeliveredMock: vi.fn().mockResolvedValue(undefined),
  callMethodMock: vi
    .fn()
    .mockResolvedValue({ result: { message: { params: {} } } }),
  getContextMock: vi.fn(),
  ensureBitrixBotIdMock: vi.fn().mockResolvedValue(1958),
  sendHubMessageMock: vi.fn().mockResolvedValue({ messageId: 'HM-1' }),
  sendInteractiveActionMock: vi.fn().mockResolvedValue({ messageId: 'HM-BTN' }),
  sendInteractiveButtonMock: vi
    .fn()
    .mockResolvedValue({ messageId: 'HM-BTN-REPLY' }),
}))

vi.mock('@/modules/thinkzap/infra/clients/hubmessage.client', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/thinkzap/infra/clients/hubmessage.client')
  >('@/modules/thinkzap/infra/clients/hubmessage.client')
  return {
    // Real: o classificador de janela fechada usa `instanceof`.
    HubMessageApiError: actual.HubMessageApiError,
    HubMessageClient: class {
      sendMessage = sendHubMessageMock
      sendInteractiveAction = sendInteractiveActionMock
      sendInteractiveButton = sendInteractiveButtonMock
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

// O módulo lança `REDIS_URL is required` no import sem a env.
vi.mock('@/queue/redis-connection', () => ({
  redisConnection: { get: vi.fn(), set: vi.fn() },
}))

const { invalidateBitrixBotIdMock } = vi.hoisted(() => ({
  invalidateBitrixBotIdMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/modules/thinkzap/application/ensure-bitrix-bot-id', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/thinkzap/application/ensure-bitrix-bot-id')
  >('@/modules/thinkzap/application/ensure-bitrix-bot-id')
  return {
    // Real: o classificador decide pelo código no corpo do erro.
    isBotNotFoundError: actual.isBotNotFoundError,
    ensureBitrixBotId: ensureBitrixBotIdMock,
    invalidateBitrixBotId: invalidateBitrixBotIdMock,
  }
})

vi.mock('@/modules/thinkzap/infra/clients/z-api.client', () => ({
  ZApiClient: class {
    sendMessage = sendMessageZApiMock
    sendImage = sendImageMock
    sendVideo = sendVideoMock
    sendAudio = sendAudioMock
    sendDocument = sendDocumentMock
    sendButtonActions = sendButtonActionsMock
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

// Dublado para não montar a árvore de repositórios de billing (Prisma, Redis, Bitrix).
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
    // Sem as SPAs de billing a árvore de repositórios não monta no import.
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

// Cota diária: reserva concedida por padrão, para os cenários sem limite seguirem iguais.
const { reserveQuotaMock, releaseQuotaMock } = vi.hoisted(() => {
  const releaseQuotaMock = vi.fn().mockResolvedValue(undefined)
  return {
    releaseQuotaMock,
    reserveQuotaMock: vi.fn().mockResolvedValue({
      status: 'reserved',
      reservation: { release: releaseQuotaMock },
    }),
  }
})

vi.mock('@/modules/thinkzap/main/make-daily-send-quota', () => ({
  makeDailySendQuota: () => ({ reserve: reserveQuotaMock }),
}))

// Idioma da instalação: português por padrão, sem tocar no banco.
const { localeByAppIdMock } = vi.hoisted(() => ({
  localeByAppIdMock: vi.fn().mockResolvedValue('pt'),
}))

vi.mock('@/modules/thinkzap/main/make-installation-locale', () => ({
  makeInstallationLocaleRepository: () => ({ byAppId: localeByAppIdMock }),
}))

import axios from 'axios'
import { processBitrixReceivedMessage } from './bitrix-received-message.processor'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { encodeButtonActionCode } from '@/modules/thinkzap/application/parse-button-action-code'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'

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

  it('recusa o envio quando o trial venceu', async () => {
    resolveLineMock.mockResolvedValue({
      ...ACTIVE_LINE,
      entitlement: 'trial-expired',
    })

    await expect(
      processBitrixReceivedMessage(makeEvent()),
    ).rejects.toMatchObject({ errorCode: 'thinkzap.line.blocked' })

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

describe('processBitrixReceivedMessage bot removido do portal', () => {
  const botNotFound = new BitrixError(
    'Bitrix error: 400 - {"error":"BOT_NOT_FOUND","error_description":"Bot not found"}',
  )

  beforeEach(() => {
    resolveLineMock.mockReset().mockResolvedValue(ACTIVE_LINE)
    getContextMock.mockResolvedValue(baseContext)
    createMock.mockClear()
    sendMessageZApiMock.mockClear()
    setMessageDeliveredMock.mockClear()
    callMethodMock.mockReset()
    callMethodMock.mockResolvedValue({ result: { message: { params: {} } } })
    invalidateBitrixBotIdMock.mockClear()
    ensureBitrixBotIdMock.mockReset()
    ensureBitrixBotIdMock.mockResolvedValueOnce(22).mockResolvedValue(1958)
  })

  it('descarta o cache, resolve o bot de novo e envia', async () => {
    callMethodMock.mockRejectedValueOnce(botNotFound)

    await processBitrixReceivedMessage(makeEvent())

    expect(invalidateBitrixBotIdMock).toHaveBeenCalledTimes(1)
    expect(ensureBitrixBotIdMock).toHaveBeenCalledTimes(2)
    expect(callMethodMock).toHaveBeenNthCalledWith(
      1,
      'imbot.v2.Chat.Message.get',
      expect.objectContaining({ botId: 22 }),
    )
    expect(callMethodMock).toHaveBeenNthCalledWith(
      2,
      'imbot.v2.Chat.Message.get',
      expect.objectContaining({ botId: 1958 }),
    )
    expect(sendMessageZApiMock).toHaveBeenCalledTimes(1)
  })

  it('outro erro do Bitrix relança sem mexer no cache', async () => {
    callMethodMock.mockRejectedValueOnce(
      new BitrixError('Bitrix error: 500 - {"error":"INTERNAL"}'),
    )

    await expect(processBitrixReceivedMessage(makeEvent())).rejects.toThrow()
    expect(invalidateBitrixBotIdMock).not.toHaveBeenCalled()
    expect(sendMessageZApiMock).not.toHaveBeenCalled()
  })

  it('bot ainda ausente depois de resolver de novo relança para a fila', async () => {
    callMethodMock.mockRejectedValue(botNotFound)

    await expect(processBitrixReceivedMessage(makeEvent())).rejects.toThrow(
      'BOT_NOT_FOUND',
    )
    expect(invalidateBitrixBotIdMock).toHaveBeenCalledTimes(1)
    expect(sendMessageZApiMock).not.toHaveBeenCalled()
  })
})

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
    // `texto enviado` vem do mock de `prepareOpenLineOutboundText`.
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

describe('processBitrixReceivedMessage envio de botões via código do canal aberto', () => {
  const buttonDescriptor = {
    body: 'Como podemos ajudar?',
    buttons: [
      { id: '1', label: 'Site', type: 'URL' as const, url: 'https://x.io' },
    ],
  }

  beforeEach(() => {
    resolveLineMock.mockReset().mockResolvedValue(ACTIVE_LINE)
    createMock.mockClear()
    createMock.mockResolvedValue(undefined)
    sendMessageZApiMock.mockClear()
    sendButtonActionsMock.mockClear()
    sendButtonActionsMock.mockResolvedValue({
      zaapId: 'z1',
      messageId: 'ZAPI-BTN',
      id: 'ZAPI-BTN',
    })
    sendHubMessageMock.mockClear()
    sendInteractiveActionMock.mockClear()
    sendInteractiveActionMock.mockResolvedValue({ messageId: 'HM-BTN' })
    setMessageDeliveredMock.mockClear()
    callMethodMock.mockClear()
    callMethodMock.mockResolvedValue({ result: { message: { params: {} } } })
    ensureBitrixBotIdMock.mockClear()
    ensureBitrixBotIdMock.mockResolvedValue(1958)
  })

  it('envia botões via Z-API e persiste como INTERACTIVE_BUTTON', async () => {
    getContextMock.mockResolvedValue(baseContext)

    await processBitrixReceivedMessage(
      makeEvent({
        message: {
          user_id: '1',
          text: encodeButtonActionCode(buttonDescriptor),
          files: undefined,
        },
      }),
    )

    expect(sendButtonActionsMock).toHaveBeenCalledTimes(1)
    expect(sendMessageZApiMock).not.toHaveBeenCalled()
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'inst-db-1',
        providerMessageId: 'ZAPI-BTN',
        type: 'INTERACTIVE_BUTTON',
        text: 'Como podemos ajudar?',
        chatId: '5511999999999',
        bitrixChatId: '100',
      }),
    )
    expect(setMessageDeliveredMock).toHaveBeenCalledTimes(1)
  })

  it('envia botões via HubMessage quando a linha é oficial', async () => {
    getContextMock.mockResolvedValue(hubMessageContext)

    await processBitrixReceivedMessage(
      makeEvent({
        message: {
          user_id: '1',
          text: encodeButtonActionCode(buttonDescriptor),
          files: undefined,
        },
      }),
    )

    expect(sendInteractiveActionMock).toHaveBeenCalledWith('CH-123', {
      recipient: { identifier: '5511999999999' },
      content: {
        type: 'INTERACTIVE_ACTION',
        body: { message: 'Como podemos ajudar?' },
        attachments: [
          { id: '1', title: 'Site', name: 'URL', url: 'https://x.io' },
        ],
      },
    })
    expect(sendHubMessageMock).not.toHaveBeenCalled()
  })

  it('aceita botão REPLY numa linha HUBMESSAGE — quick reply, via sendInteractiveButton', async () => {
    getContextMock.mockResolvedValue(hubMessageContext)
    sendInteractiveButtonMock.mockClear()

    await processBitrixReceivedMessage(
      makeEvent({
        message: {
          user_id: '1',
          text: encodeButtonActionCode({
            body: 'Oi',
            buttons: [{ id: '1', label: 'Sim', type: 'REPLY' as const }],
          }),
          files: undefined,
        },
      }),
    )

    expect(sendInteractiveButtonMock).toHaveBeenCalled()
    expect(sendInteractiveActionMock).not.toHaveBeenCalled()
  })

  it('código malformado não envia nada e não relança', async () => {
    getContextMock.mockResolvedValue(baseContext)

    await expect(
      processBitrixReceivedMessage(
        makeEvent({
          message: {
            user_id: '1',
            text: '##THINKZAP_BUTTON_ACTION##not-valid-base64-json',
            files: undefined,
          },
        }),
      ),
    ).resolves.toBeUndefined()

    expect(sendButtonActionsMock).not.toHaveBeenCalled()
    expect(sendMessageZApiMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
    expect(callMethodMock).toHaveBeenCalledWith(
      'imbot.message.add',
      expect.objectContaining({ BOT_ID: 1958, DIALOG_ID: 'chat100' }),
    )
  })

  it('janela de 24h fechada no envio de botão não persiste, não relança e avisa o operador', async () => {
    getContextMock.mockResolvedValue(hubMessageContext)
    sendInteractiveActionMock.mockRejectedValue(
      new HubMessageApiError(
        422,
        'POST',
        '/v1/channels/CH-123/messages',
        { message: 'A janela de conversa de 24 horas está fechada' },
        null,
      ),
    )

    await expect(
      processBitrixReceivedMessage(
        makeEvent({
          message: {
            user_id: '1',
            text: encodeButtonActionCode(buttonDescriptor),
            files: undefined,
          },
        }),
      ),
    ).resolves.toBeUndefined()

    expect(createMock).not.toHaveBeenCalled()
    expect(setMessageDeliveredMock).not.toHaveBeenCalled()
    expect(callMethodMock).toHaveBeenCalledWith(
      'imbot.message.add',
      expect.objectContaining({ BOT_ID: 1958, DIALOG_ID: 'chat100' }),
    )
  })

  it('mensagem comum (sem o prefixo) continua indo pelo caminho de texto livre', async () => {
    getContextMock.mockResolvedValue(baseContext)

    await processBitrixReceivedMessage(makeEvent())

    expect(sendButtonActionsMock).not.toHaveBeenCalled()
    expect(sendMessageZApiMock).toHaveBeenCalledTimes(1)
  })
})

describe('processBitrixReceivedMessage limite diário', () => {
  const LIMITED_LINE = {
    ...ACTIVE_LINE,
    settings: {
      ...ACTIVE_LINE.settings,
      dailyLimitEnabled: true,
      dailyLimit: 300,
    },
  }

  const refused = {
    status: 'refused',
    counts: { sent: 300, extra: 0 },
    effectiveLimit: 300,
  }

  beforeEach(() => {
    resolveLineMock.mockReset().mockResolvedValue(LIMITED_LINE)
    createMock.mockClear()
    sendHubMessageMock.mockClear()
    sendMessageZApiMock.mockClear()
    sendMessageZApiMock.mockResolvedValue({ messageId: 'ZAPI-1' })
    sendButtonActionsMock.mockClear()
    setMessageDeliveredMock.mockClear()
    callMethodMock.mockClear()
    callMethodMock.mockResolvedValue({ result: { message: { params: {} } } })
    reserveQuotaMock.mockClear()
    releaseQuotaMock.mockClear()
    getContextMock.mockResolvedValue(baseContext)
  })

  it('reserva a vaga na instância da linha com o limite dos settings do item', async () => {
    await processBitrixReceivedMessage(makeEvent())

    expect(reserveQuotaMock).toHaveBeenCalledWith(
      { lineKey: 'INST-A', enabled: true, limit: 300 },
      expect.any(Date),
    )
    expect(sendMessageZApiMock).toHaveBeenCalledTimes(1)
  })

  it('limite atingido: não chama o provider, avisa o operador e não relança', async () => {
    reserveQuotaMock.mockResolvedValueOnce(refused)

    await expect(
      processBitrixReceivedMessage(makeEvent()),
    ).resolves.toBeUndefined()

    expect(sendMessageZApiMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
    expect(setMessageDeliveredMock).not.toHaveBeenCalled()
    expect(callMethodMock).toHaveBeenCalledWith(
      'imbot.message.add',
      expect.objectContaining({
        BOT_ID: 1958,
        DIALOG_ID: 'chat100',
        MESSAGE: expect.stringContaining('limite diário') as unknown,
      }),
    )
  })

  it('limite atingido no envio de botões: mesmo desfecho', async () => {
    reserveQuotaMock.mockResolvedValueOnce(refused)

    await expect(
      processBitrixReceivedMessage(
        makeEvent({
          message: {
            user_id: '1',
            text: encodeButtonActionCode({
              body: 'Como podemos ajudar?',
              buttons: [
                {
                  id: '1',
                  label: 'Site',
                  type: 'URL' as const,
                  url: 'https://x.io',
                },
              ],
            }),
            files: undefined,
          },
        }),
      ),
    ).resolves.toBeUndefined()

    expect(sendButtonActionsMock).not.toHaveBeenCalled()
    expect(setMessageDeliveredMock).not.toHaveBeenCalled()
    expect(callMethodMock).toHaveBeenCalledWith(
      'imbot.message.add',
      expect.objectContaining({
        MESSAGE: expect.stringContaining('limite diário') as unknown,
      }),
    )
  })

  it('provider recusa com resposta: devolve a vaga e relança', async () => {
    // Resposta HTTP de erro da Z-API: nada saiu, a vaga volta.
    vi.mocked(axios.isAxiosError).mockReturnValue(true)
    sendMessageZApiMock.mockRejectedValueOnce(
      Object.assign(new Error('Request failed with status code 400'), {
        response: { status: 400 },
      }),
    )

    try {
      await expect(processBitrixReceivedMessage(makeEvent())).rejects.toThrow()
      expect(releaseQuotaMock).toHaveBeenCalledOnce()
    } finally {
      vi.mocked(axios.isAxiosError).mockReturnValue(false)
    }
  })

  it('linha oficial não toca na cota', async () => {
    getContextMock.mockResolvedValue(hubMessageContext)
    sendHubMessageMock.mockResolvedValue({ messageId: 'HM-1' })

    await processBitrixReceivedMessage(makeEvent())

    expect(reserveQuotaMock).not.toHaveBeenCalled()
    expect(sendHubMessageMock).toHaveBeenCalledTimes(1)
  })

  it('instalação em inglês: o aviso no chat sai em inglês', async () => {
    reserveQuotaMock.mockResolvedValueOnce(refused)
    localeByAppIdMock.mockResolvedValueOnce('en')

    await processBitrixReceivedMessage(makeEvent())

    expect(localeByAppIdMock).toHaveBeenCalledWith('app-1')
    expect(callMethodMock).toHaveBeenCalledWith(
      'imbot.message.add',
      expect.objectContaining({
        MESSAGE: expect.stringContaining(
          'Your message was not delivered',
        ) as unknown,
      }),
    )
  })
})

describe('processBitrixReceivedMessage avisos no idioma da instalação', () => {
  beforeEach(() => {
    resolveLineMock.mockReset().mockResolvedValue(ACTIVE_LINE)
    createMock.mockClear()
    sendHubMessageMock.mockClear()
    sendButtonActionsMock.mockClear()
    setMessageDeliveredMock.mockClear()
    callMethodMock.mockClear()
    callMethodMock.mockResolvedValue({ result: { message: { params: {} } } })
    localeByAppIdMock.mockReset().mockResolvedValue('pt')
  })

  const noticeSent = () =>
    callMethodMock.mock.calls
      .filter(([method]) => method === 'imbot.message.add')
      .map(([, params]) => (params as { MESSAGE: string }).MESSAGE)

  it('janela de 24h fechada em inglês', async () => {
    getContextMock.mockResolvedValue(hubMessageContext)
    localeByAppIdMock.mockResolvedValue('en')
    sendHubMessageMock.mockRejectedValueOnce(
      new HubMessageApiError(
        422,
        'POST',
        '/v1/channels/CH-123/messages',
        { message: 'A janela de conversa de 24 horas está fechada' },
        null,
      ),
    )

    await processBitrixReceivedMessage(makeEvent())

    expect(localeByAppIdMock).toHaveBeenCalledWith('app-1')
    expect(noticeSent()[0]).toContain('Your message was not delivered')
  })

  it('código de botões corrompido em espanhol', async () => {
    getContextMock.mockResolvedValue(baseContext)
    localeByAppIdMock.mockResolvedValue('es')

    await processBitrixReceivedMessage(
      makeEvent({
        message: {
          user_id: '1',
          text: '##THINKZAP_BUTTON_ACTION##not-valid-base64-json',
          files: undefined,
        },
      }),
    )

    const [notice] = noticeSent()
    expect(notice).toContain('El envío de botones no fue entregado')
    expect(notice).toContain('el mensaje llegó dañado')
  })

  it('sem idioma escolhido: o aviso da janela fica no texto de hoje', async () => {
    getContextMock.mockResolvedValue(hubMessageContext)
    sendHubMessageMock.mockRejectedValueOnce(
      new HubMessageApiError(
        422,
        'POST',
        '/v1/channels/CH-123/messages',
        { message: 'A janela de conversa de 24 horas está fechada' },
        null,
      ),
    )

    await processBitrixReceivedMessage(makeEvent())

    expect(noticeSent()[0]).toBe(
      '⚠️ Sua mensagem não foi entregue: o contato não interage há mais de 24 horas ' +
        'e o WhatsApp Oficial só permite mensagem livre dentro dessa janela. ' +
        'Para retomar a conversa, é preciso enviar um template aprovado.',
    )
  })
})
