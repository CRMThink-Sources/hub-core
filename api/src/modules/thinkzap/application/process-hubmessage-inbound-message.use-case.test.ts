import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendMessageMock = vi.fn().mockResolvedValue({ ok: true })
const getLastMessageIdMock = vi.fn().mockResolvedValue(null)

vi.mock('@/shared/infra/clients/bitrix.client', () => {
  class BitrixClient {
    sendMessage = sendMessageMock
    getLastMessageId = getLastMessageIdMock
  }
  return { BitrixClient }
})

vi.mock('@/config/env', () => ({
  env: {
    bitrix: { connector: { code: 'thinkzap' } },
    // A resolução da linha pelo item usa o appCode para escopar a instalação.
    appCodes: { thinkzap: 'crmthink.thinkzap' },
    logLevel: 'silent',
    nodeEnv: 'test',
  },
}))

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository',
  () => ({ PrismaThinkzapMessageRepository: vi.fn() }),
)

import { ProcessHubMessageInboundMessageUseCase } from './process-hubmessage-inbound-message.use-case'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import type { HubMessageWebhookMessage } from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import type { ISendMessageData } from '@/shared/infra/clients/bitrix.client'

const CHANNEL_ID = '019F5CC904597D81817829E11B7679F2'

const baseInstance = {
  id: 'instance-db-1',
  instanceId: CHANNEL_ID,
  channelId: CHANNEL_ID,
  vinculatedChannel: '12',
  domainId: 'domain-1',
}

/**
 * A linha vem do item de assinatura. `Connector` saiu: servia para o guard de
 * provider e para `appId`, e o item dá os dois — declarando o provider por qual
 * par de credencial está preenchido.
 */
const baseItem = {
  id: 'i1',
  name: 'Linha oficial',
  subscription: 'sub-1',
  status: 'active' as const,
  settings: {},
  vinculatedChannel: '12',
  metadata: {
    provider: ConnectorProvider.HUBMESSAGE,
    hubmessageChannelId: CHANNEL_ID,
    wabaId: 'W-9',
  },
}

function makeMessage(
  overrides: Partial<HubMessageWebhookMessage> = {},
): HubMessageWebhookMessage {
  return {
    _id: '019F5D201EAA795BA7B46A820C7CA289',
    channel_id: CHANNEL_ID,
    // Contém o número do NOSSO WABA, não o do contato — nunca deve virar chat.id.
    chat_id: `${CHANNEL_ID}=15553840789`,
    created: 1783973813930,
    metadata: { from_me: false, moment: 1783973812000 },
    sender: { identifier: '554792259475', name: 'Romuca' },
    recipient: { identifier: '15553840789' },
    contents: [{ type: 'TEXT', message: 'Outra msg de teste' }],
    attachments: [],
    ...overrides,
  }
}

function buildUseCase({
  instance = baseInstance,
  item = baseItem,
  repoFind,
  repoCreate,
  subscriptionStatus = 'active',
  currentPeriodEnd = new Date('2099-01-01T00:00:00.000Z'),
}: {
  instance?: unknown
  item?: unknown
  repoFind?: ReturnType<typeof vi.fn>
  repoCreate?: ReturnType<typeof vi.fn>
  subscriptionStatus?: string
  currentPeriodEnd?: Date
} = {}) {
  const messageRepo = {
    findByProviderMessageId: repoFind ?? vi.fn().mockResolvedValue(null),
    create: repoCreate ?? vi.fn().mockResolvedValue(undefined),
  }

  /** Ver a nota equivalente no teste do caminho Z-API. */
  const disconnectExpiredLine = { schedule: vi.fn() }

  const useCase = new ProcessHubMessageInboundMessageUseCase(
    {
      execute: vi.fn().mockResolvedValue({
        customer: { id: 'domain-1', name: 'acme' },
        aplication: { id: 'app-1', spaId: '42' },
        // Assinatura ativa: sem `status`, o entitlement cai em `inactive` e a
        // mensagem é descartada antes de qualquer efeito.
        subscriptions: [
          {
            id: 'sub-1',
            status: subscriptionStatus,
            currentPeriodEnd,
            items: item ? [item] : [],
          },
        ],
      }),
    } as never,
    {
      getInstanceByChannelId: vi.fn().mockResolvedValue(instance),
    } as never,
    {
      getDomainById: vi
        .fn()
        .mockResolvedValue({ id: 'domain-1', name: 'acme' }),
    } as never,
    {
      getById: vi.fn().mockResolvedValue({ id: 'app-1' }),
      getByAppCodeAndDomainId: vi.fn().mockResolvedValue({ id: 'app-1' }),
    } as never,
    { get: vi.fn().mockResolvedValue({ id: 'cred-1' }) } as never,
    messageRepo as never,
    disconnectExpiredLine as never,
  )

  return { useCase, messageRepo, disconnectExpiredLine }
}

function sentPayload(callIndex = 0): ISendMessageData {
  return sendMessageMock.mock.calls[callIndex]?.[0] as ISendMessageData
}

describe('ProcessHubMessageInboundMessageUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendMessageMock.mockResolvedValue({ ok: true })
    getLastMessageIdMock.mockResolvedValue(null)
  })

  /**
   * Trial vencido: descarta **antes** de persistir. Mensagem de linha bloqueada não
   * deve virar row em `messages` nem aparecer no CRM.
   */
  it('discards the message when the trial has expired', async () => {
    const { useCase, messageRepo } = buildUseCase({
      subscriptionStatus: 'trialing',
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
    })

    await useCase.execute(makeMessage())

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(messageRepo.create).not.toHaveBeenCalled()
  })

  it('discards the message when the subscription is cancelled', async () => {
    const { useCase, messageRepo } = buildUseCase({
      subscriptionStatus: 'cancelled',
    })

    await useCase.execute(makeMessage())

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(messageRepo.create).not.toHaveBeenCalled()
  })

  /** Mesmo papel do caminho Z-API: mensagem chegando prova canal ainda vivo. */
  it('agenda a desconexão do canal quando o trial venceu', async () => {
    const { useCase, disconnectExpiredLine } = buildUseCase({
      subscriptionStatus: 'trialing',
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
    })

    await useCase.execute(makeMessage())

    expect(disconnectExpiredLine.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i1' }),
      'trial-expired',
    )
  })

  it('não agenda desconexão para linha habilitada', async () => {
    const { useCase, disconnectExpiredLine } = buildUseCase()

    await useCase.execute(makeMessage())

    expect(disconnectExpiredLine.schedule).not.toHaveBeenCalled()
  })

  /**
   * Descarte não é erro para o provider: exceção aqui vira retry no worker, e a
   * HubMessage reentregaria indefinidamente uma mensagem que nunca vai ser aceita.
   */
  it('does not throw when discarding — the provider must not retry', async () => {
    const { useCase } = buildUseCase({
      subscriptionStatus: 'trialing',
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
    })

    await expect(useCase.execute(makeMessage())).resolves.toBeUndefined()
  })

  /** Trial dentro da janela funciona igual a assinatura paga. */
  it('processes normally while the trial window is open', async () => {
    const { useCase } = buildUseCase({
      subscriptionStatus: 'trialing',
      currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
    })

    await useCase.execute(makeMessage())

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  it('sends text to the open channel keyed by the contact phone, not by chat_id', async () => {
    const { useCase } = buildUseCase()

    await useCase.execute(makeMessage())

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    const payload = sentPayload()

    expect(payload.CONNECTOR).toBe('thinkzap')
    expect(payload.LINE).toBe(12)

    const sent = payload.MESSAGES[0]!
    // Identidade = identifier cru do contato; o normalizado (com 9o digito) so
    // aparece em user.phone, pro Bitrix casar o contato no CRM.
    expect(sent.chat.id).toBe('554792259475')
    expect(sent.user.id).toBe('554792259475')
    expect(sent.user.phone).toBe('5547992259475')
    expect(sent.chat.id).not.toContain('15553840789')
    expect(sent.chat.id).not.toContain(CHANNEL_ID)
    expect(sent.message.id).toBe('019F5D201EAA795BA7B46A820C7CA289')
    expect(sent.message.text).toBe('Outra msg de teste')
    expect(sent.message.date).toBe(new Date(1783973812000).toISOString())
  })

  it('reuses the same chat id for two messages of the same contact', async () => {
    const { useCase } = buildUseCase()

    await useCase.execute(makeMessage({ _id: 'MSG-A' }))
    await useCase.execute(makeMessage({ _id: 'MSG-B' }))

    expect(sentPayload(0).MESSAGES[0]!.chat.id).toBe('554792259475')
    expect(sentPayload(1).MESSAGES[0]!.chat.id).toBe('554792259475')
  })

  it('gives distinct chat ids to distinct contacts sharing the same chat_id', async () => {
    const { useCase } = buildUseCase()

    await useCase.execute(makeMessage({ _id: 'MSG-A' }))
    await useCase.execute(
      makeMessage({
        _id: 'MSG-B',
        sender: { identifier: '5511999998888', name: 'Outro' },
      }),
    )

    expect(sentPayload(0).MESSAGES[0]!.chat.id).toBe('554792259475')
    expect(sentPayload(1).MESSAGES[0]!.chat.id).toBe('5511999998888')
  })

  /**
   * O guard de provider virou consequência da busca: `findLineItemByChannelId`
   * filtra por `HUBMESSAGE`, então uma linha Z-API que use esse id nunca
   * corresponde. Mesma proteção, um caminho a menos.
   */
  it('refuses to process when no HUBMESSAGE line owns the channel', async () => {
    const { useCase } = buildUseCase({
      item: {
        ...baseItem,
        metadata: {
          provider: ConnectorProvider.ZAPI,
          zApiInstanceId: CHANNEL_ID,
          zApiInstanceToken: 'tok',
        },
      },
    })

    await expect(useCase.execute(makeMessage())).rejects.toThrow(/HUBMESSAGE/)
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it('skips sending when the message id was already delivered', async () => {
    const repoFind = vi.fn().mockResolvedValue({
      id: 'msg-db-1',
      providerMessageId: '019F5D201EAA795BA7B46A820C7CA289',
    })
    const { useCase, messageRepo } = buildUseCase({ repoFind })

    await useCase.execute(makeMessage())

    expect(repoFind).toHaveBeenCalledWith(
      'instance-db-1',
      '019F5D201EAA795BA7B46A820C7CA289',
    )
    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(messageRepo.create).not.toHaveBeenCalled()
  })

  it('throws when the channel is unknown', async () => {
    const { useCase } = buildUseCase({ instance: null })

    await expect(useCase.execute(makeMessage())).rejects.toThrow(
      'Instance not found for HubMessage channel',
    )
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it('throws when the instance has no vinculated channel', async () => {
    const { useCase } = buildUseCase({
      item: { ...baseItem, vinculatedChannel: null },
    })

    await expect(useCase.execute(makeMessage())).rejects.toThrow(
      'Instance has no vinculated channel',
    )
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it('skips unsupported content without throwing', async () => {
    const { useCase, messageRepo } = buildUseCase()

    await expect(
      useCase.execute(makeMessage({ contents: [], attachments: [] })),
    ).resolves.toBeUndefined()

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(messageRepo.create).not.toHaveBeenCalled()
  })

  it('persists the snapshot with the bitrix chat id after sending', async () => {
    sendMessageMock.mockResolvedValue({
      result: { DATA: { RESULT: [{ session: { CHAT_ID: '1801' } }] } },
    })
    getLastMessageIdMock.mockResolvedValue('456')

    const { useCase, messageRepo } = buildUseCase()

    await useCase.execute(makeMessage())

    expect(messageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'instance-db-1',
        source: 'HUBMESSAGE',
        providerMessageId: '019F5D201EAA795BA7B46A820C7CA289',
        bitrixChatId: '1801',
        bitrixMessageId: '456',
        chatId: '554792259475',
        type: 'TEXT',
        text: 'Outra msg de teste',
      }),
    )
  })

  it('sends media as files with the caption as text', async () => {
    const { useCase } = buildUseCase()

    await useCase.execute(
      makeMessage({
        contents: [],
        attachments: [
          {
            type: 'IMAGE',
            url: 'https://exemplo.com/imagem.png',
            caption: 'Confira',
          },
        ],
      }),
    )

    const sent = sentPayload().MESSAGES[0]!
    expect(sent.message.text).toBe('Confira')
    expect(sent.message.files).toEqual([
      { url: 'https://exemplo.com/imagem.png', name: 'Imagem' },
    ])
  })

  it('completes the job when persistence fails after a successful send', async () => {
    const repoCreate = vi.fn().mockRejectedValue(new Error('db down'))
    const { useCase } = buildUseCase({ repoCreate })

    await expect(useCase.execute(makeMessage())).resolves.toBeUndefined()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })
})
