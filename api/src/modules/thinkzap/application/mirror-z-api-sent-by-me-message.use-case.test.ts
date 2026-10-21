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

type Record_ = {
  source: string
  providerMessageId: string
  bitrixMessageId?: string | null
  bitrixUserId?: string | null
}

function buildUseCase({
  mirrorEnabled = true,
  vinculatedChannel = '10',
  subscriptionStatus = 'active',
  conversation = { bitrixChatId: '777' } as unknown,
  records = {} as Partial<Record<string, Record_>>,
  locale = 'pt',
  // Sem operador por padrão: os cenários do conector seguem como o contato.
  operatorId = null as string | null,
  operatorToken = 'op-token' as string | null | Error,
  imResponse = { result: 9001 } as unknown,
  markPendingFails = false,
  cadence = null as null | { registerExternal: ReturnType<typeof vi.fn> },
}: {
  mirrorEnabled?: boolean
  vinculatedChannel?: string | null
  subscriptionStatus?: string
  conversation?: unknown
  records?: Partial<Record<string, Record_>>
  locale?: string
  operatorId?: string | null
  operatorToken?: string | null | Error
  imResponse?: unknown
  markPendingFails?: boolean
  cadence?: null | { registerExternal: ReturnType<typeof vi.fn> }
} = {}) {
  const messageRepo = {
    findByProviderMessageId: vi.fn((_: string, id: string) =>
      Promise.resolve(records[id] ?? null),
    ),
    findLatestOpenChannelChat: vi.fn().mockResolvedValue(conversation),
    findLatestOperatorForChat: vi.fn().mockResolvedValue(operatorId),
    create: vi.fn().mockResolvedValue(undefined),
  }

  const imCallMethod = vi.fn().mockResolvedValue(imResponse)
  const reservations = {
    markPending: markPendingFails
      ? vi.fn().mockRejectedValue(new Error('redis down'))
      : vi.fn().mockResolvedValue(undefined),
    clearPending: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
  }
  const operatorAuthor = {
    resolveAccessToken:
      operatorToken instanceof Error
        ? vi.fn().mockRejectedValue(operatorToken)
        : vi.fn().mockResolvedValue(operatorToken),
    createClient: vi.fn(() => ({ callMethod: imCallMethod })),
    reservations,
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
    operatorAuthor as never,
    cadence as never,
  )

  return {
    run: (event: ReceivedMessageEvent) => useCase.execute(event, jobLog),
    lines,
    messageRepo,
    resolveContactIdentity,
    disconnectExpiredLine,
    operatorAuthor,
    imCallMethod,
    reservations,
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

describe('MirrorZApiSentByMeMessageUseCase — autor operador da sessão', () => {
  beforeEach(() => {
    sendMessageMock.mockReset().mockResolvedValue(sessionResult)
    updateMessageMock.mockClear()
    deleteMessageMock.mockClear()
  })

  it('posta como o último operador da conversa, com o prefixo, sem passar pelo conector', async () => {
    const { run, messageRepo, operatorAuthor, imCallMethod, reservations } =
      buildUseCase({ operatorId: '27' })

    await run(makeEvent())

    expect(messageRepo.findLatestOperatorForChat).toHaveBeenCalledWith(
      'instance-db-1',
      '777',
    )
    expect(operatorAuthor.resolveAccessToken).toHaveBeenCalledWith(
      'acme.bitrix24.com.br',
      '27',
    )
    expect(operatorAuthor.createClient).toHaveBeenCalledWith(
      'acme.bitrix24.com.br',
      'op-token',
    )
    expect(imCallMethod).toHaveBeenCalledWith('im.message.add', {
      DIALOG_ID: 'chat777',
      MESSAGE: PREFIX_PT + 'Bom dia',
    })
    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(reservations.register).toHaveBeenCalledWith(
      'acme.bitrix24.com.br',
      '9001',
      'ME-1',
    )
    expect(messageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'ZAPI',
        providerMessageId: 'ME-1',
        bitrixMessageId: '9001',
        bitrixChatId: '777',
        chatId: LID,
        bitrixUserId: '27',
      }),
    )
  })

  it('marca o chat pendente antes de postar e só limpa depois de gravar a row', async () => {
    const { run, messageRepo, imCallMethod, reservations } = buildUseCase({
      operatorId: '27',
    })

    await run(makeEvent())

    const order = (fn: { mock: { invocationCallOrder: number[] } }) =>
      fn.mock.invocationCallOrder[0]!
    expect(order(reservations.markPending)).toBeLessThan(order(imCallMethod))
    expect(order(reservations.register)).toBeLessThan(order(messageRepo.create))
    expect(order(messageRepo.create)).toBeLessThan(
      order(reservations.clearPending),
    )
  })

  it('sem operador na conversa: posta como o contato e registra o motivo', async () => {
    const { run, lines, imCallMethod } = buildUseCase({ operatorId: null })

    await run(makeEvent())

    expect(imCallMethod).not.toHaveBeenCalled()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(lines.some(l => l.includes('sem operador na conversa'))).toBe(true)
  })

  it('operador sem autorização do app: posta como o contato', async () => {
    const { run, lines, imCallMethod } = buildUseCase({
      operatorId: '27',
      operatorToken: null,
    })

    await run(makeEvent())

    expect(imCallMethod).not.toHaveBeenCalled()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(lines.some(l => l.includes('sem autorização do app'))).toBe(true)
  })

  it('refresh do token falha: posta como o contato', async () => {
    const { run, imCallMethod } = buildUseCase({
      operatorId: '27',
      operatorToken: new Error('invalid_grant'),
    })

    await run(makeEvent())

    expect(imCallMethod).not.toHaveBeenCalled()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  it('Bitrix recusa a postagem do operador: posta como o contato e limpa o pendente', async () => {
    const { run, lines, reservations, messageRepo } = buildUseCase({
      operatorId: '27',
      imResponse: {
        error: 'CANCELED',
        error_description: 'Você não pode enviar mensagens para o bate-papo',
      },
    })

    await run(makeEvent())

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(reservations.register).not.toHaveBeenCalled()
    expect(reservations.clearPending).toHaveBeenCalledTimes(1)
    expect(messageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ bitrixUserId: undefined }),
    )
    expect(
      lines.some(l => l.includes('CANCELED') || l.includes('bate-papo')),
    ).toBe(true)
  })

  it('sem reserva anti-loop não posta como operador', async () => {
    const { run, imCallMethod } = buildUseCase({
      operatorId: '27',
      markPendingFails: true,
    })

    await run(makeEvent())

    expect(imCallMethod).not.toHaveBeenCalled()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  it('mídia segue como o contato nesta versão', async () => {
    const { run, messageRepo, imCallMethod } = buildUseCase({
      operatorId: '27',
    })

    await run(
      makeEvent({
        text: undefined,
        image: {
          imageUrl: 'https://img/orc.png',
          caption: 'segue',
          mimeType: 'image/png',
        } as ReceivedMessageEvent['image'],
      }),
    )

    expect(messageRepo.findLatestOperatorForChat).not.toHaveBeenCalled()
    expect(imCallMethod).not.toHaveBeenCalled()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  describe('edição e remoção de cópia postada como operador', () => {
    const copiaDoOperador = {
      'ME-1': {
        source: 'ZAPI',
        providerMessageId: 'ME-1',
        bitrixMessageId: '9001',
        bitrixUserId: '27',
      },
    }

    it('edição usa im.message.update com o token do operador', async () => {
      const { run, imCallMethod, operatorAuthor } = buildUseCase({
        records: copiaDoOperador,
        imResponse: { result: true },
      })

      await run(
        makeEvent({
          isEdit: true,
          editMessageId: 'EDIT-1',
          text: { message: 'Boa tarde' },
        }),
      )

      expect(operatorAuthor.resolveAccessToken).toHaveBeenCalledWith(
        'acme.bitrix24.com.br',
        '27',
      )
      expect(imCallMethod).toHaveBeenCalledWith('im.message.update', {
        MESSAGE_ID: '9001',
        MESSAGE: PREFIX_PT + 'Boa tarde',
      })
      expect(updateMessageMock).not.toHaveBeenCalled()
    })

    it('remoção usa im.message.delete', async () => {
      const { run, imCallMethod } = buildUseCase({
        records: copiaDoOperador,
        imResponse: { result: true },
      })

      await run(makeEvent({ notification: 'REVOKE' }))

      expect(imCallMethod).toHaveBeenCalledWith('im.message.delete', {
        MESSAGE_ID: '9001',
      })
      expect(deleteMessageMock).not.toHaveBeenCalled()
    })

    it('sem token do operador, a cópia fica como está', async () => {
      const { run, imCallMethod, lines } = buildUseCase({
        records: copiaDoOperador,
        operatorToken: null,
      })

      await run(
        makeEvent({
          isEdit: true,
          editMessageId: 'EDIT-1',
          text: { message: 'Boa tarde' },
        }),
      )

      expect(imCallMethod).not.toHaveBeenCalled()
      expect(updateMessageMock).not.toHaveBeenCalled()
      expect(lines.some(l => l.includes('autorização válida'))).toBe(true)
    })
  })
})

describe('MirrorZApiSentByMeMessageUseCase — cadência', () => {
  beforeEach(() => {
    sendMessageMock.mockReset().mockResolvedValue(sessionResult)
  })

  const cadenceSpy = () => ({
    registerExternal: vi.fn().mockResolvedValue(undefined),
  })

  it('Espelhada conta: a mensagem nova do aparelho é registrada na janela da linha', async () => {
    const cadence = cadenceSpy()
    const { run } = buildUseCase({ cadence })

    await run(makeEvent())

    expect(cadence.registerExternal).toHaveBeenCalledTimes(1)
    expect(cadence.registerExternal).toHaveBeenCalledWith(
      expect.objectContaining({ lineKey: baseInstance.instanceId }),
      expect.any(Date),
    )
  })

  it('conta mesmo quando a cópia não chega ao canal aberto (sem conversa)', async () => {
    const cadence = cadenceSpy()
    const { run } = buildUseCase({ cadence, conversation: null })

    await run(makeEvent())

    expect(cadence.registerExternal).toHaveBeenCalledTimes(1)
  })

  it('duplicata (já saiu pela integração) não conta', async () => {
    const cadence = cadenceSpy()
    const { run } = buildUseCase({
      cadence,
      records: { 'ME-1': { source: 'BITRIX', providerMessageId: 'ME-1' } },
    })

    await run(makeEvent())

    expect(cadence.registerExternal).not.toHaveBeenCalled()
  })

  it('edição e remoção não contam', async () => {
    const cadence = cadenceSpy()
    const { run } = buildUseCase({
      cadence,
      records: { 'ME-1': { source: 'ZAPI', providerMessageId: 'ME-1' } },
    })

    await run(
      makeEvent({
        isEdit: true,
        editMessageId: 'EDIT-1',
        text: { message: 'x' },
      }),
    )

    expect(cadence.registerExternal).not.toHaveBeenCalled()
  })

  it('falha do Redis não impede o espelhamento', async () => {
    const cadence = {
      registerExternal: vi.fn().mockRejectedValue(new Error('redis')),
    }
    const { run } = buildUseCase({ cadence })

    await run(makeEvent())

    expect(sendMessageMock).toHaveBeenCalled()
  })
})
