import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendMessageMock = vi.fn()
const updateMessageMock = vi.fn().mockResolvedValue({ ok: true })
const deleteMessageMock = vi.fn().mockResolvedValue({ ok: true })
const getLastMessageIdMock = vi.fn().mockResolvedValue('bx-msg-9')

vi.mock('@/shared/infra/clients/bitrix.client', () => {
  class BitrixClient {
    sendMessage = sendMessageMock
    updateMessage = updateMessageMock
    deleteMessage = deleteMessageMock
    getLastMessageId = getLastMessageIdMock
  }
  return { BitrixClient }
})

vi.mock('@/config/env', () => ({
  env: {
    bitrix: { connector: { code: 'thinkzap' } },
    appCodes: { thinkzap: 'crmthink.thinkzap' },
    logLevel: 'silent',
    nodeEnv: 'test',
  },
}))

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository',
  () => ({
    PrismaThinkzapMessageRepository: vi.fn(),
    toQuoteInput: (record: { type: string; text: string | null }) => ({
      type: record.type,
      text: record.text ?? undefined,
    }),
  }),
)

import { MirrorZApiSentByMeMessageUseCase } from './mirror-z-api-sent-by-me-message.use-case'
import type { ReceivedMessageEvent } from '@/shared/infra/handlers/z-api/z-api'
import type { ISendMessageData } from '@/shared/infra/clients/bitrix.client'

const LID = '3577724534928@lid'
const PREFIX_PT = '[Mensagem enviada pelo WhatsApp do aparelho]\n'

const baseInstance = {
  id: 'instance-db-1',
  instanceId: 'INST-A',
  domainId: 'domain-1',
  zApiToken: 'zapi-token-1',
}

function makeEvent(
  overrides: Partial<ReceivedMessageEvent> = {},
): ReceivedMessageEvent {
  return {
    notification: '',
    chatLid: LID,
    senderLid: '999999999@lid',
    isEdit: false,
    isGroup: false,
    instanceId: 'INST-A',
    messageId: 'ME-1',
    phone: '5511999999999',
    fromMe: true,
    fromApi: false,
    momment: 1700000000000,
    chatName: 'Maria Cliente',
    senderName: 'Loja da Linha',
    photo: 'https://foto/maria.png',
    editMessageId: '',
    type: 'ReceivedCallback',
    text: { message: 'Bom dia' },
    ...overrides,
  } as ReceivedMessageEvent
}

type Record_ = { source: string; providerMessageId: string }

function buildUseCase({
  mirrorEnabled = true,
  vinculatedChannel = '10',
  subscriptionStatus = 'active',
  conversation = { bitrixChatId: '777' } as unknown,
  records = {} as Partial<Record<string, Record_>>,
  locale = 'pt',
}: {
  mirrorEnabled?: boolean
  vinculatedChannel?: string | null
  subscriptionStatus?: string
  conversation?: unknown
  records?: Partial<Record<string, Record_>>
  locale?: string
} = {}) {
  const messageRepo = {
    findByProviderMessageId: vi.fn((_: string, id: string) =>
      Promise.resolve(records[id] ?? null),
    ),
    findLatestOpenChannelChat: vi.fn().mockResolvedValue(conversation),
    create: vi.fn().mockResolvedValue(undefined),
  }

  const resolveContactIdentity = vi.fn().mockResolvedValue({
    identity: LID,
    lid: LID,
    phone: '5511999999999',
    source: 'chatLid',
    legacy: false,
  })

  const lines: string[] = []
  const jobLog = {
    appendJobLog: (line: string) => {
      lines.push(line)
      return Promise.resolve()
    },
  }

  const disconnectExpiredLine = { schedule: vi.fn() }

  const useCase = new MirrorZApiSentByMeMessageUseCase(
    {
      execute: vi.fn().mockResolvedValue({
        customer: { id: 'domain-1', name: 'acme' },
        aplication: { id: 'app-1', spaId: '42' },
        subscriptions: [
          {
            id: 'sub-1',
            status: subscriptionStatus,
            currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
            items: [
              {
                id: 'i1',
                name: 'Linha',
                subscription: 'sub-1',
                status: 'active',
                settings: { deviceMessageMirrorEnabled: mirrorEnabled },
                vinculatedChannel,
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
        .mockResolvedValue({ id: 'domain-1', name: 'acme.bitrix24.com.br' }),
    } as never,
    {
      getById: vi.fn().mockResolvedValue({ id: 'app-1' }),
      getByAppCodeAndDomainId: vi.fn().mockResolvedValue({ id: 'app-1' }),
    } as never,
    { get: vi.fn().mockResolvedValue({ id: 'cred-1' }) } as never,
    messageRepo as never,
    disconnectExpiredLine as never,
    resolveContactIdentity,
    vi.fn().mockImplementation((text: string) => Promise.resolve(text)),
    { byInstallation: vi.fn().mockResolvedValue(locale) },
  )

  return {
    run: (event: ReceivedMessageEvent) => useCase.execute(event, jobLog),
    lines,
    messageRepo,
    resolveContactIdentity,
    disconnectExpiredLine,
  }
}

function sentPayload(mock = sendMessageMock): ISendMessageData {
  return mock.mock.calls[0]![0] as ISendMessageData
}

const sessionResult = {
  result: { DATA: { RESULT: [{ session: { CHAT_ID: '777' } }] } },
}

describe('MirrorZApiSentByMeMessageUseCase', () => {
  beforeEach(() => {
    sendMessageMock.mockReset().mockResolvedValue(sessionResult)
    updateMessageMock.mockClear()
    deleteMessageMock.mockClear()
    getLastMessageIdMock.mockClear()
  })

  it('espelha na conversa existente com o prefixo, como o contato', async () => {
    const { run, messageRepo } = buildUseCase()

    await run(makeEvent())

    const payload = sentPayload()
    const message = payload.MESSAGES[0]!
    expect(payload.LINE).toBe(10)
    expect(message.chat.id).toBe(LID)
    expect(message.message.text).toBe(PREFIX_PT + 'Bom dia')
    expect(message.message.id).toBe('ME-1')
    // Nome é do destinatário, nunca o `senderName` (que é a própria linha).
    expect(message.user.name).toBe('Maria Cliente')
    expect(messageRepo.findLatestOpenChannelChat).toHaveBeenCalledWith(
      'instance-db-1',
      LID,
    )
    expect(messageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'ZAPI',
        providerMessageId: 'ME-1',
        bitrixChatId: '777',
        bitrixMessageId: 'bx-msg-9',
        chatId: LID,
      }),
    )
  })

  it('não passa o senderLid (LID da linha) para a identidade', async () => {
    const { run, resolveContactIdentity } = buildUseCase()

    await run(makeEvent())

    expect(resolveContactIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        event: { phone: '5511999999999', chatLid: LID, senderLid: null },
      }),
    )
  })

  it('descarta sem conversa existente, sem abrir conversa', async () => {
    const { run, lines, messageRepo } = buildUseCase({ conversation: null })

    await run(makeEvent())

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(messageRepo.create).not.toHaveBeenCalled()
    expect(lines.some(l => l.includes('sem conversa existente'))).toBe(true)
  })

  it('descarta com o toggle desligado', async () => {
    const { run, lines, messageRepo } = buildUseCase({ mirrorEnabled: false })

    await run(makeEvent())

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(messageRepo.findLatestOpenChannelChat).not.toHaveBeenCalled()
    expect(lines.some(l => l.includes('toggle'))).toBe(true)
  })

  it('descarta com a linha sem assinatura ativa', async () => {
    const { run, disconnectExpiredLine } = buildUseCase({
      subscriptionStatus: 'canceled',
    })

    await run(makeEvent())

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(disconnectExpiredLine.schedule).toHaveBeenCalled()
  })

  it('descarta sem canal vinculado, sem falhar o job', async () => {
    const { run } = buildUseCase({ vinculatedChannel: null })

    await expect(run(makeEvent())).resolves.toBeUndefined()
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it('descarta mensagem já registrada (saiu pela integração)', async () => {
    const { run, lines } = buildUseCase({
      records: { 'ME-1': { source: 'BITRIX', providerMessageId: 'ME-1' } },
    })

    await run(makeEvent())

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(lines.some(l => l.includes('já registrado'))).toBe(true)
  })

  it('usa o prefixo no idioma da instalação', async () => {
    const { run } = buildUseCase({ locale: 'es' })

    await run(makeEvent())

    expect(sentPayload().MESSAGES[0]!.message.text).toBe(
      '[Mensaje enviado desde el WhatsApp del dispositivo]\nBom dia',
    )
  })

  it('espelha imagem com a legenda', async () => {
    const { run } = buildUseCase()

    await run(
      makeEvent({
        text: undefined,
        image: {
          imageUrl: 'https://img/orc.png',
          caption: 'segue o orçamento',
          mimeType: 'image/png',
        } as ReceivedMessageEvent['image'],
      }),
    )

    const message = sentPayload().MESSAGES[0]!.message
    expect(message.text).toBe(PREFIX_PT + 'segue o orçamento')
    expect(message.files).toEqual([
      { url: 'https://img/orc.png', name: 'image/png' },
    ])
  })

  it('espelha contato encaminhado no formato do recebido', async () => {
    const { run } = buildUseCase()

    await run(
      makeEvent({
        text: undefined,
        contact: { displayName: 'Ana', vCard: '', phones: ['5511888'] },
      }),
    )

    const text = sentPayload().MESSAGES[0]!.message.text
    expect(text.startsWith(PREFIX_PT)).toBe(true)
    expect(text).toContain('[b]Ana[/b]')
    expect(text).toContain('📞 5511888')
  })

  it('descarta notificação de sistema do grupo', async () => {
    const { run } = buildUseCase()

    await run(makeEvent({ isGroup: true, notification: 'GROUP_CREATE' }))

    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  describe('grupo', () => {
    const grupo = {
      isGroup: true,
      phone: '120363-group',
      chatName: 'Equipe Vendas',
    }

    it('espelha na conversa do grupo, sem o nome do autor', async () => {
      const { run, messageRepo } = buildUseCase()

      await run(makeEvent(grupo))

      const message = sentPayload().MESSAGES[0]!
      expect(message.chat.id).toBe('120363-group')
      expect(message.message.text).toBe(PREFIX_PT + 'Bom dia')
      expect(message.message.text).not.toContain('Loja da Linha')
      expect(messageRepo.findLatestOpenChannelChat).toHaveBeenCalledWith(
        'instance-db-1',
        '120363-group',
      )
    })

    it('descarta grupo sem conversa existente', async () => {
      const { run } = buildUseCase({ conversation: null })

      await run(makeEvent(grupo))

      expect(sendMessageMock).not.toHaveBeenCalled()
    })
  })

  describe('edição e remoção', () => {
    const espelhada = {
      'ME-1': { source: 'ZAPI', providerMessageId: 'ME-1' },
    }

    it('edição de mensagem espelhada atualiza a cópia, com o prefixo', async () => {
      const { run, messageRepo } = buildUseCase({ records: espelhada })

      await run(
        makeEvent({
          isEdit: true,
          editMessageId: 'EDIT-1',
          text: { message: 'Boa tarde' },
        }),
      )

      const payload = sentPayload(updateMessageMock)
      expect(payload.MESSAGES[0]!.message.id).toBe('ME-1')
      expect(payload.MESSAGES[0]!.message.text).toBe(PREFIX_PT + 'Boa tarde')
      expect(sendMessageMock).not.toHaveBeenCalled()
      expect(messageRepo.create).not.toHaveBeenCalled()
    })

    it('remoção de mensagem espelhada remove a cópia', async () => {
      const { run } = buildUseCase({ records: espelhada })

      await run(makeEvent({ notification: 'REVOKE' }))

      expect(deleteMessageMock).toHaveBeenCalledTimes(1)
      expect(sentPayload(deleteMessageMock).MESSAGES[0]!.message.id).toBe(
        'ME-1',
      )
    })

    it('remoção de mensagem não espelhada não faz nada', async () => {
      const { run, lines } = buildUseCase()

      await run(makeEvent({ notification: 'REVOKE' }))

      expect(deleteMessageMock).not.toHaveBeenCalled()
      expect(lines.some(l => l.includes('não foi espelhada'))).toBe(true)
    })

    it('edição de mensagem do operador (row BITRIX) não é tocada', async () => {
      const { run } = buildUseCase({
        records: { 'ME-1': { source: 'BITRIX', providerMessageId: 'ME-1' } },
      })

      await run(makeEvent({ isEdit: true, editMessageId: 'EDIT-1' }))

      expect(updateMessageMock).not.toHaveBeenCalled()
    })
  })
})
