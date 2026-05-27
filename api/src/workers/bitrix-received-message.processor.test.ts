import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'

const mocks = vi.hoisted(() => ({
  getContext: vi.fn(),
  sendMessage: vi.fn(),
  setMessageDelivered: vi.fn(),
  prepareOpenLineOutboundText: vi.fn(),
}))

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-bitrix-webhook-context.repository',
  () => ({
    PrismaBitrixWebhookContextRepository: class {
      getContext = mocks.getContext
    },
  }),
)

vi.mock('@/modules/thinkzap/infra/clients/z-api.client', () => ({
  ZApiClient: class {
    sendMessage = mocks.sendMessage
  },
}))

vi.mock('@/shared/infra/clients/bitrix.client', () => ({
  BitrixClient: class {
    setMessageDelivered = mocks.setMessageDelivered
  },
}))

vi.mock(
  '@/modules/thinkzap/infra/adapters/bitrix-get-user-display-name.adapter',
  () => ({
    BitrixGetUserDisplayNameAdapter: vi.fn(),
  }),
)

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-allowed-user.repository',
  () => ({
    PrismaAllowedUserRepository: vi.fn(),
  }),
)

vi.mock(
  '@/modules/thinkzap/application/prepare-open-line-outbound-text',
  () => ({
    prepareOpenLineOutboundText: mocks.prepareOpenLineOutboundText,
  }),
)

import { processBitrixReceivedMessage } from './bitrix-received-message.processor'

const baseEvent: IBX24MessageEvent = {
  event: 'ONIMCONNECTORMESSAGEADD',
  event_handler_id: '1',
  data: {
    CONNECTOR: 'thinkzap',
    LINE: '10',
    MESSAGES: [
      {
        im: { chat_id: 'chat-1', message_id: 'msg-1' },
        message: {
          user_id: '42',
          text: 'Olá',
        },
        chat: { id: '5511999999999' },
      },
    ],
  },
  ts: '1',
  auth: {
    access_token: 'token',
    expires: '1',
    expires_in: '3600',
    scope: 'im',
    domain: 'acme.bitrix24.com.br',
    server_endpoint: 'https://acme.bitrix24.com.br/rest/',
    status: 'L',
    client_endpoint: 'https://acme.bitrix24.com.br/rest/',
    member_id: 'member',
    user_id: '42',
    application_token: 'app-token',
  },
}

describe('processBitrixReceivedMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getContext.mockResolvedValue({
      id: 'domain-1',
      name: 'acme.bitrix24.com.br',
      memberId: 'member',
      app: {
        id: 'app-1',
        domainId: 'domain-1',
        appCodeId: 'crmthink.thinkzap',
        status: 'ACTIVE',
        credential: {},
      },
      instance: {
        id: 'instance-db-1',
        instanceId: 'z-api-1',
        zApiToken: 'z-token',
        settings: DEFAULT_CONNECTOR_SETTINGS,
        vinculatedChannel: '10',
        domainId: 'domain-1',
        status: 'CONNECTED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    mocks.prepareOpenLineOutboundText.mockResolvedValue('Olá')
    mocks.sendMessage.mockResolvedValue({ messageId: 'z-msg-1' })
    mocks.setMessageDelivered.mockResolvedValue(undefined)
  })

  it('sends raw text when prefix setting is disabled', async () => {
    await processBitrixReceivedMessage(baseEvent)

    expect(mocks.prepareOpenLineOutboundText).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Olá',
        settings: DEFAULT_CONNECTOR_SETTINGS,
        operatorUserId: '42',
      }),
    )
    expect(mocks.sendMessage).toHaveBeenCalledWith(
      'z-api-1',
      'z-token',
      'Olá',
      '5511999999999',
    )
  })

  it('sends prefixed text when prepare helper returns prefixed message', async () => {
    mocks.getContext.mockResolvedValue({
      id: 'domain-1',
      name: 'acme.bitrix24.com.br',
      memberId: 'member',
      app: {
        id: 'app-1',
        domainId: 'domain-1',
        appCodeId: 'crmthink.thinkzap',
        status: 'ACTIVE',
        credential: {},
      },
      instance: {
        id: 'instance-db-1',
        instanceId: 'z-api-1',
        zApiToken: 'z-token',
        settings: { prefixOperatorNameEnabled: true },
        vinculatedChannel: '10',
        domainId: 'domain-1',
        status: 'CONNECTED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    mocks.prepareOpenLineOutboundText.mockResolvedValue('João Silva: Olá')

    await processBitrixReceivedMessage(baseEvent)

    expect(mocks.sendMessage).toHaveBeenCalledWith(
      'z-api-1',
      'z-token',
      'João Silva: Olá',
      '5511999999999',
    )
  })
})
