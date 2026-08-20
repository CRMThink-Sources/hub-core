import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendMessageMock = vi.fn().mockResolvedValue({ ok: true })
const updateMessageMock = vi.fn().mockResolvedValue({ ok: true })
const deleteMessageMock = vi.fn().mockResolvedValue({ ok: true })
const getLastMessageIdMock = vi.fn().mockResolvedValue(null)

vi.mock('@/shared/infra/clients/bitrix.client', () => {
  class BitrixClient {
    sendMessage = sendMessageMock
    updateMessage = updateMessageMock
    deleteMessage = deleteMessageMock
    getLastMessageId = getLastMessageIdMock
  }
  return { BitrixClient }
})

function withSession(chatId: string) {
  return {
    result: {
      DATA: {
        RESULT: [{ session: { CHAT_ID: chatId } }],
      },
    },
  }
}

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
  () => ({
    PrismaThinkzapMessageRepository: vi.fn(),
    toQuoteInput: (record: {
      type: string
      text: string | null
      fileName: string | null
    }) => ({
      type: record.type,
      text: record.text ?? undefined,
      fileName: record.fileName ?? undefined,
    }),
  }),
)

import { ProcessZApiInboundMessageUseCase } from './process-z-api-inbound-message.use-case'
import { ReceivedMessageEvent } from '@/shared/infra/handlers/z-api/z-api'
import { ISendMessageData } from '@/shared/infra/clients/bitrix.client'

const baseInstance = {
  id: 'instance-db-1',
  instanceId: 'INST-A',
  vinculatedChannel: '10',
  domainId: 'domain-1',
}

const baseConnector = {
  id: 'connector-1',
  instanceId: 'instance-db-1',
  appId: 'app-1',
}

function makeEvent(
  overrides: Partial<ReceivedMessageEvent> = {},
): ReceivedMessageEvent {
  return {
    notification: '',
    isStatusReply: false,
    chatLid: 'chat-lid',
    connectedPhone: '',
    waitingMessage: false,
    isEdit: false,
    isGroup: false,
    isNewsletter: false,
    instanceId: 'INST-A',
    messageId: 'MSG-1',
    phone: '5511999999999',
    fromMe: false,
    momment: 1700000000000,
    status: '',
    chatName: 'João',
    senderPhoto: '',
    senderName: 'João',
    photo: '',
    broadcast: false,
    participantPhone: '',
    participantLid: null,
    editMessageId: '',
    messageExpirationSeconds: 0,
    forwarded: false,
    type: 'ReceivedCallback',
    fromApi: false,
    _traceContext: { traceId: '', spanId: '' },
    text: { message: 'mensagem' },
    ...overrides,
  } as ReceivedMessageEvent
}

function buildUseCase({
  repoFind,
  repoCreate,
  subscriptionStatus = 'active',
  currentPeriodEnd = new Date('2099-01-01T00:00:00.000Z'),
}: {
  repoFind?: ReturnType<typeof vi.fn>
  repoCreate?: ReturnType<typeof vi.fn>
  subscriptionStatus?: string
  currentPeriodEnd?: Date
} = {}) {
  const messageRepo = {
    findByProviderMessageId: repoFind ?? vi.fn().mockResolvedValue(null),
    create: repoCreate ?? vi.fn().mockResolvedValue(undefined),
  }

  /**
   * Desconexão do recurso na expiração. Dublê aqui porque o que este arquivo mede é
   * o **descarte**; que o `disconnect` de fato aconteça é assunto de
   * `disconnect-expired-line.test.ts`.
   */
  const disconnectExpiredLine = { schedule: vi.fn() }

  const useCase = new ProcessZApiInboundMessageUseCase(
    /**
     * A linha vem do item de assinatura. `GetConnectorRepository` saiu: só servia
     * para descobrir `appId`, e exigia row de `Connector` que linha nascida na SPA
     * não tem.
     */
    {
      execute: vi.fn().mockResolvedValue({
        customer: { id: 'domain-1', name: 'acme' },
        aplication: { id: 'app-1', spaId: '42' },
        subscriptions: [
          {
            id: 'sub-1',
            // Assinatura ativa por default: sem `status`, o entitlement cai em
            // `inactive` e a mensagem é descartada antes de qualquer efeito.
            status: subscriptionStatus,
            currentPeriodEnd,
            items: [
              {
                id: 'i1',
                name: 'Linha',
                subscription: 'sub-1',
                status: 'active',
                settings: {},
                vinculatedChannel: '10',
                metadata: {
                  provider: 'ZAPI',
                  zApiInstanceId: baseInstance.instanceId,
                  zApiInstanceToken: 'tok',
                },
              },
            ],
          },
        ],
      }),
    } as never,
    {
      getInstanceByInstanceId: vi.fn().mockResolvedValue(baseInstance),
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
    {
      get: vi.fn().mockResolvedValue({ id: 'cred-1' }),
    } as never,
    messageRepo as never,
    disconnectExpiredLine as never,
  )

  return { useCase, messageRepo, disconnectExpiredLine }
}

describe('ProcessZApiInboundMessageUseCase reply handling', () => {
  beforeEach(() => {
    sendMessageMock.mockClear().mockResolvedValue({ ok: true })
    updateMessageMock.mockClear()
    deleteMessageMock.mockClear()
    getLastMessageIdMock.mockClear().mockResolvedValue(null)
  })

  /**
   * Trial vencido: descarta **antes** de persistir. Mensagem de linha bloqueada não
   * deve virar row em `messages` nem chegar ao canal aberto.
   */
  it('discards the message when the trial has expired', async () => {
    const { useCase, messageRepo } = buildUseCase({
      subscriptionStatus: 'trialing',
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
    })

    await useCase.execute(makeEvent())

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(messageRepo.create).not.toHaveBeenCalled()
  })

  /**
   * Mensagem chegando de uma linha expirada é a prova de que o telefone do cliente
   * ainda está pareado: se o app só descartasse, mensagem de cliente final entraria
   * e desapareceria sem rastro.
   */
  it('agenda a desconexão do recurso quando o trial venceu', async () => {
    const { useCase, disconnectExpiredLine } = buildUseCase({
      subscriptionStatus: 'trialing',
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
    })

    await useCase.execute(makeEvent())

    expect(disconnectExpiredLine.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i1' }),
      'trial-expired',
    )
  })

  it('não agenda desconexão para linha habilitada', async () => {
    const { useCase, disconnectExpiredLine } = buildUseCase()

    await useCase.execute(makeEvent())

    expect(disconnectExpiredLine.schedule).not.toHaveBeenCalled()
  })

  it('discards the message when the subscription is cancelled', async () => {
    const { useCase, messageRepo } = buildUseCase({
      subscriptionStatus: 'cancelled',
    })

    await useCase.execute(makeEvent())

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(messageRepo.create).not.toHaveBeenCalled()
  })

  /**
   * Descarte não é erro para o provider: exceção vira retry no worker, e a Z-API
   * reentregaria indefinidamente uma mensagem que nunca vai ser aceita.
   */
  it('does not throw when discarding — the provider must not retry', async () => {
    const { useCase } = buildUseCase({
      subscriptionStatus: 'trialing',
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
    })

    await expect(useCase.execute(makeEvent())).resolves.toBeUndefined()
  })

  /** Trial dentro da janela funciona igual a assinatura paga. */
  it('processes normally while the trial window is open', async () => {
    const { useCase } = buildUseCase({
      subscriptionStatus: 'trialing',
      currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
    })

    await useCase.execute(makeEvent())

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  it('sends message without prefix when referenceMessageId absent', async () => {
    const { useCase, messageRepo } = buildUseCase()
    await useCase.execute(makeEvent())

    expect(messageRepo.findByProviderMessageId).not.toHaveBeenCalled()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.message.text).toBe('mensagem')
  })

  it('prefixes BBCode quote when reference DB hit', async () => {
    const { useCase, messageRepo } = buildUseCase({
      repoFind: vi.fn().mockResolvedValue({
        id: 'rec-1',
        instanceId: 'INST-A',
        source: 'ZAPI',
        providerMessageId: 'PREV',
        bitrixMessageId: null,
        type: 'TEXT',
        text: 'Bom dia',
        fileName: null,
        chatId: null,
        createdAt: new Date(),
      }),
    })

    await useCase.execute(
      makeEvent({
        referenceMessageId: 'PREV',
        text: { message: 'tudo bem?' },
      }),
    )

    expect(messageRepo.findByProviderMessageId).toHaveBeenCalledWith(
      'instance-db-1',
      'PREV',
    )
    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.message.text).toBe('>>Bom dia\ntudo bem?')
  })

  it('uses generic fallback when reference DB miss', async () => {
    const { useCase } = buildUseCase({
      repoFind: vi.fn().mockResolvedValue(null),
    })

    await useCase.execute(
      makeEvent({
        referenceMessageId: 'PREV',
        text: { message: 'tudo bem?' },
      }),
    )

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.message.text).toBe(
      '>>↩ Resposta a mensagem anterior\ntudo bem?',
    )
  })

  it('uses generic fallback when DB findByProviderMessageId throws', async () => {
    const { useCase } = buildUseCase({
      repoFind: vi.fn().mockRejectedValue(new Error('db down')),
    })

    await useCase.execute(
      makeEvent({
        referenceMessageId: 'PREV',
        text: { message: 'tudo bem?' },
      }),
    )

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.message.text).toBe(
      '>>↩ Resposta a mensagem anterior\ntudo bem?',
    )
  })

  it('does not throw when DB create fails after Bitrix send', async () => {
    const { useCase, messageRepo } = buildUseCase({
      repoCreate: vi.fn().mockRejectedValue(new Error('db write failed')),
    })

    await expect(useCase.execute(makeEvent())).resolves.toBeUndefined()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(messageRepo.create).toHaveBeenCalled()
  })

  it('persists inbound text snapshot after successful send', async () => {
    const { useCase, messageRepo } = buildUseCase()
    await useCase.execute(makeEvent({ text: { message: 'hello' } }))

    expect(messageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'instance-db-1',
        source: 'ZAPI',
        providerMessageId: 'MSG-1',
        type: 'TEXT',
        text: 'hello',
      }),
    )
  })

  it('skips DB write on REVOKE notifications', async () => {
    const { useCase, messageRepo } = buildUseCase()
    await useCase.execute(makeEvent({ notification: 'REVOKE' }))

    expect(deleteMessageMock).toHaveBeenCalledTimes(1)
    expect(messageRepo.create).not.toHaveBeenCalled()
  })

  it('skips DB write on edits', async () => {
    const { useCase, messageRepo } = buildUseCase()
    await useCase.execute(makeEvent({ isEdit: true, editMessageId: 'OLD-MSG' }))

    expect(updateMessageMock).toHaveBeenCalledTimes(1)
    expect(messageRepo.create).not.toHaveBeenCalled()
  })

  it('forwards sticker as Sticker.webp file attachment', async () => {
    const { useCase } = buildUseCase()
    await useCase.execute(
      makeEvent({
        text: undefined,
        sticker: {
          stickerUrl: 'https://cdn.example.com/sticker.webp',
          mimeType: 'image/webp',
          width: 0,
          height: 0,
        },
      }),
    )

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.message.files).toEqual([
      { url: 'https://cdn.example.com/sticker.webp', name: 'Sticker.webp' },
    ])
    expect(payload.MESSAGES[0]!.message.text).toBe('')
  })

  /**
   * Documento com comentário: o `caption` do Z-API é o que o contato escreveu, e
   * era descartado — o canal aberto recebia o arquivo sem texto.
   */
  it('forwards document caption as the message text', async () => {
    const { useCase, messageRepo } = buildUseCase()
    await useCase.execute(
      makeEvent({
        text: undefined,
        document: {
          documentUrl: 'https://cdn.example.com/termo.pdf',
          fileName: '5479 - Termo ERP + LGPD.pdf',
          mimeType: 'application/pdf',
          caption: 'Testando envio de documento com texto',
        },
      }),
    )

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.message.text).toBe(
      'Testando envio de documento com texto',
    )
    expect(payload.MESSAGES[0]!.message.files).toEqual([
      {
        url: 'https://cdn.example.com/termo.pdf',
        name: '5479 - Termo ERP + LGPD.pdf',
      },
    ])
    expect(messageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DOCUMENT',
        text: 'Testando envio de documento com texto',
        fileName: '5479 - Termo ERP + LGPD.pdf',
      }),
    )
  })

  it('forwards document without caption as empty text', async () => {
    const { useCase } = buildUseCase()
    await useCase.execute(
      makeEvent({
        text: undefined,
        document: {
          documentUrl: 'https://cdn.example.com/f.pdf',
          fileName: 'f.pdf',
          mimeType: 'application/pdf',
        },
      }),
    )

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.message.text).toBe('')
  })

  /** O grupo tinha a mesma cadeia de ternários — e o mesmo furo. */
  it('forwards document caption in group message, after sender prefix', async () => {
    const { useCase } = buildUseCase()
    await useCase.execute(
      makeEvent({
        isGroup: true,
        phone: '5511999999999-group',
        senderName: 'Maria',
        text: undefined,
        document: {
          documentUrl: 'https://cdn.example.com/termo.pdf',
          fileName: 'termo.pdf',
          mimeType: 'application/pdf',
          caption: 'segue o termo',
        },
      }),
    )

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.message.text).toBe(
      '[b]Maria[/b]:\nsegue o termo',
    )
  })

  it('builds group reply preserving sender prefix order', async () => {
    const { useCase } = buildUseCase({
      repoFind: vi.fn().mockResolvedValue({
        id: 'rec-2',
        instanceId: 'INST-A',
        source: 'ZAPI',
        providerMessageId: 'PREV',
        bitrixMessageId: null,
        type: 'TEXT',
        text: 'Bom dia',
        fileName: null,
        chatId: null,
        createdAt: new Date(),
      }),
    })

    await useCase.execute(
      makeEvent({
        isGroup: true,
        phone: '5511999999999-group',
        referenceMessageId: 'PREV',
        senderName: 'Maria',
        text: { message: 'OK' },
      }),
    )

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.message.text).toBe(
      '>>Bom dia\n[b]Maria[/b]:\nOK',
    )
  })

  it('persists real bitrixMessageId resolved via im.dialog.get', async () => {
    sendMessageMock.mockResolvedValueOnce(withSession('1767'))
    getLastMessageIdMock.mockResolvedValueOnce('456')
    const { useCase, messageRepo } = buildUseCase()

    await useCase.execute(makeEvent({ text: { message: 'hello' } }))

    expect(getLastMessageIdMock).toHaveBeenCalledWith('1767')
    expect(messageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bitrixMessageId: '456',
        bitrixChatId: '1767',
      }),
    )
  })

  it('persists bitrixMessageId=null when im.dialog.get fails', async () => {
    sendMessageMock.mockResolvedValueOnce(withSession('1769'))
    getLastMessageIdMock.mockResolvedValueOnce(null)
    const { useCase, messageRepo } = buildUseCase()

    await useCase.execute(makeEvent({ text: { message: 'hello' } }))

    expect(getLastMessageIdMock).toHaveBeenCalledWith('1769')
    expect(messageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bitrixMessageId: null,
        bitrixChatId: '1769',
      }),
    )
  })

  it('does not look up bitrixMessageId when session/CHAT_ID absent', async () => {
    sendMessageMock.mockResolvedValueOnce({ ok: true })
    const { useCase, messageRepo } = buildUseCase()

    await useCase.execute(makeEvent({ text: { message: 'hello' } }))

    expect(getLastMessageIdMock).not.toHaveBeenCalled()
    expect(messageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bitrixMessageId: null,
        bitrixChatId: null,
      }),
    )
  })

  it('does not look up bitrixMessageId on REVOKE', async () => {
    const { useCase } = buildUseCase()
    await useCase.execute(makeEvent({ notification: 'REVOKE' }))

    expect(getLastMessageIdMock).not.toHaveBeenCalled()
  })

  it('does not look up bitrixMessageId on edits', async () => {
    const { useCase } = buildUseCase()
    await useCase.execute(makeEvent({ isEdit: true, editMessageId: 'OLD-MSG' }))

    expect(getLastMessageIdMock).not.toHaveBeenCalled()
  })

  it('forwards phone with ninth digit inserted for direct message missing it', async () => {
    const { useCase } = buildUseCase()
    await useCase.execute(
      makeEvent({ phone: '551199999999', text: { message: 'hello' } }),
    )

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.user.phone).toBe('5511999999999')
    expect(payload.MESSAGES[0]!.chat.name).toContain('5511999999999')
  })

  it('forwards landline-shaped phone unmodified for direct message', async () => {
    const { useCase } = buildUseCase()
    await useCase.execute(
      makeEvent({ phone: '551133334444', text: { message: 'hello' } }),
    )

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.user.phone).toBe('551133334444')
  })

  it('forwards normalized phone for group message', async () => {
    const { useCase } = buildUseCase()
    await useCase.execute(
      makeEvent({
        isGroup: true,
        phone: '5511999999999-group',
        text: { message: 'hello' },
      }),
    )

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.user.phone).toBe('5511999999999')
  })
})
