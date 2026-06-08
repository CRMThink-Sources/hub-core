import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createMock,
  sendMessageZApiMock,
  sendImageMock,
  sendVideoMock,
  sendAudioMock,
  sendDocumentMock,
  setMessageDeliveredMock,
  getContextMock,
} = vi.hoisted(() => ({
  createMock: vi.fn().mockResolvedValue(undefined),
  sendMessageZApiMock: vi.fn().mockResolvedValue({ messageId: 'ZAPI-1' }),
  sendImageMock: vi.fn().mockResolvedValue({ messageId: 'ZAPI-IMG' }),
  sendVideoMock: vi.fn().mockResolvedValue({ messageId: 'ZAPI-VID' }),
  sendAudioMock: vi.fn().mockResolvedValue({ messageId: 'ZAPI-AUD' }),
  sendDocumentMock: vi.fn().mockResolvedValue({ messageId: 'ZAPI-DOC' }),
  setMessageDeliveredMock: vi.fn().mockResolvedValue(undefined),
  getContextMock: vi.fn(),
}))

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository',
  () => ({
    PrismaThinkzapMessageRepository: class {
      create = createMock
    },
  }),
)

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

vi.mock(
  '@/modules/auth/presentation/controllers/helpers/app-id-resolver',
  () => ({
    appIdResolver: { thinkzap: 'app-code-thinkzap' },
  }),
)

vi.mock('@/config/env', () => ({
  env: {
    bitrix: { connector: { code: 'thinkzap' } },
    zApi: { partnerToken: 'pt', clientToken: 'ct' },
    appCodes: { thinkzap: 'thinkzap' },
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
import { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'

const baseContext = {
  name: 'acme.bitrix24.com',
  app: { id: 'app-1', credential: { id: 'cred-1' } },
  instance: {
    id: 'inst-db-1',
    instanceId: 'INST-A',
    zApiToken: 'token',
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
    createMock.mockClear()
    createMock.mockResolvedValue(undefined)
    sendMessageZApiMock.mockClear()
    sendImageMock.mockClear()
    sendVideoMock.mockClear()
    sendAudioMock.mockClear()
    sendDocumentMock.mockClear()
    getContextMock.mockResolvedValue(baseContext)
  })

  it('persists text message with correct IDs', async () => {
    await processBitrixReceivedMessage(makeEvent())

    expect(sendMessageZApiMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'inst-db-1',
        source: 'BITRIX',
        zApiMessageId: 'ZAPI-1',
        bitrixMessageId: 'BITRIX-MSG-1',
        type: 'TEXT',
        chatId: '5511999999999',
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
        zApiMessageId: 'ZAPI-IMG',
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
        zApiMessageId: 'ZAPI-DOC',
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
