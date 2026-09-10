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

/** LID do contato de teste. O payload da Z-API traz `phone` e `chatLid` juntos. */
const LID = '3577724534928@lid'

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
  domain = { id: 'domain-1', name: 'acme.bitrix24.com.br' },
  identityOverride,
}: {
  repoFind?: ReturnType<typeof vi.fn>
  repoCreate?: ReturnType<typeof vi.fn>
  subscriptionStatus?: string
  currentPeriodEnd?: Date
  domain?: unknown
  identityOverride?: {
    identity?: string
    lid?: string | null
    phone?: string | null
    source?: string
    legacy?: boolean
  }
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

  /**
   * Coletor da **aba Logs** do job. Aqui pesa mais que no caminho oficial: grupo,
   * edição e `REVOKE` encerram o job sem mensagem nova no canal aberto, e sem linha
   * na aba os três são indistinguíveis de mensagem perdida.
   */
  const lines: string[] = []
  const jobLog = {
    appendJobLog: (line: string) => {
      lines.push(line)
      return Promise.resolve()
    },
  }

  const getDomainById = vi.fn().mockResolvedValue(domain)

  /**
   * A resolução da identidade é dublada aqui porque o que este arquivo mede é o payload
   * que sai para o Bitrix, não a cadeia de LID — essa tem arquivo próprio
   * (`resolve-zapi-contact-identity.test.ts`).
   *
   * O default reproduz o caso comum: contato com telefone e LID, sem identidade legada.
   */
  const resolveContactIdentity = vi.fn().mockResolvedValue({
    identity: identityOverride?.identity ?? LID,
    lid: identityOverride?.lid ?? LID,
    phone:
      identityOverride && 'phone' in identityOverride
        ? identityOverride.phone
        : '5511999999999',
    source: identityOverride?.source ?? 'chatLid',
    legacy: identityOverride?.legacy ?? false,
  })

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
    { getDomainById } as never,
    {
      getById: vi.fn().mockResolvedValue({ id: 'app-1' }),
      getByAppCodeAndDomainId: vi.fn().mockResolvedValue({ id: 'app-1' }),
    } as never,
    {
      get: vi.fn().mockResolvedValue({ id: 'cred-1' }),
    } as never,
    messageRepo as never,
    disconnectExpiredLine as never,
    resolveContactIdentity,
  )

  /** Todo `execute` do teste passa pelo coletor; `useCase` fica exposto para o caso sem contexto. */
  const run = (event: ReceivedMessageEvent) => useCase.execute(event, jobLog)

  return {
    useCase,
    run,
    lines,
    getDomainById,
    messageRepo,
    disconnectExpiredLine,
  }
}

/** A aba tem que nomear o portal — `domainId` é uuid e não serve para abrir o CRM. */
function expectNamesDomain(lines: string[]): void {
  expect(lines.some(line => line.includes('acme.bitrix24.com.br'))).toBe(true)
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
    const { run, messageRepo, lines } = buildUseCase({
      subscriptionStatus: 'trialing',
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
    })

    await run(makeEvent())

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(messageRepo.create).not.toHaveBeenCalled()

    const discard = lines.find(line => line.includes('DESCARTADA'))
    expect(discard).toContain('sem assinatura ativa')
    expect(discard).toContain('trial-expired')
    expect(discard).toContain('item=i1')
    expectNamesDomain(lines)
  })

  /**
   * Mensagem chegando de uma linha expirada é a prova de que o telefone do cliente
   * ainda está pareado: se o app só descartasse, mensagem de cliente final entraria
   * e desapareceria sem rastro.
   */
  it('agenda a desconexão do recurso quando o trial venceu', async () => {
    const { run, disconnectExpiredLine } = buildUseCase({
      subscriptionStatus: 'trialing',
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
    })

    await run(makeEvent())

    expect(disconnectExpiredLine.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i1' }),
      'trial-expired',
    )
  })

  it('não agenda desconexão para linha habilitada', async () => {
    const { run, disconnectExpiredLine } = buildUseCase()

    await run(makeEvent())

    expect(disconnectExpiredLine.schedule).not.toHaveBeenCalled()
  })

  it('discards the message when the subscription is cancelled', async () => {
    const { run, messageRepo } = buildUseCase({
      subscriptionStatus: 'cancelled',
    })

    await run(makeEvent())

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(messageRepo.create).not.toHaveBeenCalled()
  })

  /**
   * Descarte não é erro para o provider: exceção vira retry no worker, e a Z-API
   * reentregaria indefinidamente uma mensagem que nunca vai ser aceita.
   */
  it('does not throw when discarding — the provider must not retry', async () => {
    const { run } = buildUseCase({
      subscriptionStatus: 'trialing',
      currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
    })

    await expect(run(makeEvent())).resolves.toBeUndefined()
  })

  /** Trial dentro da janela funciona igual a assinatura paga. */
  it('processes normally while the trial window is open', async () => {
    const { run } = buildUseCase({
      subscriptionStatus: 'trialing',
      currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
    })

    await run(makeEvent())

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  it('sends message without prefix when referenceMessageId absent', async () => {
    const { run, messageRepo } = buildUseCase()
    await run(makeEvent())

    expect(messageRepo.findByProviderMessageId).not.toHaveBeenCalled()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.message.text).toBe('mensagem')
  })

  it('prefixes BBCode quote when reference DB hit', async () => {
    const { run, messageRepo } = buildUseCase({
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

    await run(
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
    const { run } = buildUseCase({
      repoFind: vi.fn().mockResolvedValue(null),
    })

    await run(
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
    const { run } = buildUseCase({
      repoFind: vi.fn().mockRejectedValue(new Error('db down')),
    })

    await run(
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
    const { run, messageRepo, lines } = buildUseCase({
      repoCreate: vi.fn().mockRejectedValue(new Error('db write failed')),
    })

    await expect(run(makeEvent())).resolves.toBeUndefined()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(messageRepo.create).toHaveBeenCalled()

    const failure = lines.find(line => line.includes('persistência falhou'))
    expect(failure).toContain('ENTREGUE')
    expect(failure).toContain('db write failed')
  })

  it('persists inbound text snapshot after successful send', async () => {
    const { run, messageRepo } = buildUseCase()
    await run(makeEvent({ text: { message: 'hello' } }))

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
    const { run, messageRepo, lines } = buildUseCase()
    await run(makeEvent({ notification: 'REVOKE' }))

    expect(deleteMessageMock).toHaveBeenCalledTimes(1)
    expect(messageRepo.create).not.toHaveBeenCalled()

    /**
     * `completed` sem mensagem nova no canal aberto é o esperado aqui. A aba tem que
     * dizer isso, senão o desfecho é indistinguível de mensagem perdida.
     */
    expect(lines.some(line => line.includes('deleteMessage'))).toBe(true)
    expect(
      lines.some(line => line.includes('Nenhum registro persistido')),
    ).toBe(true)
  })

  it('skips DB write on edits', async () => {
    const { run, messageRepo, lines } = buildUseCase()
    await run(makeEvent({ isEdit: true, editMessageId: 'OLD-MSG' }))

    expect(updateMessageMock).toHaveBeenCalledTimes(1)
    expect(messageRepo.create).not.toHaveBeenCalled()

    expect(lines[0]).toContain('edição=sim')
    expect(lines.some(line => line.includes('updateMessage'))).toBe(true)
    expect(
      lines.some(line => line.includes('Nenhum registro persistido')),
    ).toBe(true)
  })

  it('descarta edição sem editMessageId nomeando o campo ausente', async () => {
    const { run, lines } = buildUseCase()

    await expect(
      run(makeEvent({ isEdit: true, editMessageId: '' })),
    ).resolves.toBeUndefined()

    expect(updateMessageMock).not.toHaveBeenCalled()
    const discard = lines.find(line => line.includes('DESCARTADA'))
    expect(discard).toContain('editMessageId')
    expect(discard).toContain('MSG-1')
  })

  it('forwards sticker as Sticker.webp file attachment', async () => {
    const { run } = buildUseCase()
    await run(
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
    const { run, messageRepo } = buildUseCase()
    await run(
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
    const { run } = buildUseCase()
    await run(
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
    const { run } = buildUseCase()
    await run(
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
    const { run } = buildUseCase({
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

    await run(
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
    const { run, messageRepo } = buildUseCase()

    await run(makeEvent({ text: { message: 'hello' } }))

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
    const { run, messageRepo } = buildUseCase()

    await run(makeEvent({ text: { message: 'hello' } }))

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
    const { run, messageRepo } = buildUseCase()

    await run(makeEvent({ text: { message: 'hello' } }))

    expect(getLastMessageIdMock).not.toHaveBeenCalled()
    expect(messageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bitrixMessageId: null,
        bitrixChatId: null,
      }),
    )
  })

  it('does not look up bitrixMessageId on REVOKE', async () => {
    const { run } = buildUseCase()
    await run(makeEvent({ notification: 'REVOKE' }))

    expect(getLastMessageIdMock).not.toHaveBeenCalled()
  })

  it('does not look up bitrixMessageId on edits', async () => {
    const { run } = buildUseCase()
    await run(makeEvent({ isEdit: true, editMessageId: 'OLD-MSG' }))

    expect(getLastMessageIdMock).not.toHaveBeenCalled()
  })

  it('forwards phone with ninth digit inserted for direct message missing it', async () => {
    const { run } = buildUseCase()
    await run(makeEvent({ phone: '551199999999', text: { message: 'hello' } }))

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.user.phone).toBe('5511999999999')
    expect(payload.MESSAGES[0]!.chat.name).toContain('5511999999999')
  })

  it('forwards landline-shaped phone unmodified for direct message', async () => {
    const { run } = buildUseCase({
      identityOverride: { phone: '551133334444' },
    })
    await run(makeEvent({ phone: '551133334444', text: { message: 'hello' } }))

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.user.phone).toBe('551133334444')
  })

  it('forwards normalized phone for group message', async () => {
    const { run } = buildUseCase()
    await run(
      makeEvent({
        isGroup: true,
        phone: '5511999999999-group',
        text: { message: 'hello' },
      }),
    )

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.user.phone).toBe('5511999999999')
  })

  /**
   * A inversão desta change.
   *
   * O cenário antigo afirmava `chat.id` = telefone canônico, "não o chatLid" — e era
   * essa regra que fazia o mesmo contato abrir duas conversas, porque a Z-API entrega o
   * `phone` ora como número, ora como `@lid`. Agora a identidade é o que a cadeia de LID
   * resolveu, e o telefone existe no payload só como dado do contato.
   */
  it('identifica o chat pela identidade resolvida, não pelo telefone', async () => {
    const { run } = buildUseCase()
    await run(
      makeEvent({
        phone: '551199999999',
        chatLid: LID,
        text: { message: 'hello' },
      }),
    )

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.chat.id).toBe(LID)
    expect(payload.MESSAGES[0]!.user.id).toBe(LID)
    expect(payload.MESSAGES[0]!.user.phone).toBe('5511999999999')
  })

  /**
   * As duas formas em que a Z-API entrega o mesmo contato convergem. É a asserção que
   * prova o conserto da duplicidade relatada.
   */
  it('phone numérico e phone lid do mesmo contato caem na mesma identidade', async () => {
    const { run } = buildUseCase()

    await run(makeEvent({ phone: '551199999999', chatLid: LID }))
    await run(makeEvent({ phone: LID, chatLid: LID, messageId: 'MSG-2' }))

    const first = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    const second = sendMessageMock.mock.calls[1]![0] as ISendMessageData
    expect(first.MESSAGES[0]!.chat.id).toBe(second.MESSAGES[0]!.chat.id)
  })

  /** Contato que já tinha conversa antes da mudança não ganha uma nova. */
  it('usa a identidade legada quando a resolução a devolve', async () => {
    const { run } = buildUseCase({
      identityOverride: { identity: '5511999999999', lid: LID, legacy: true },
    })
    await run(makeEvent({ chatLid: LID, text: { message: 'hello' } }))

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.chat.id).toBe('5511999999999')
  })

  /**
   * Contato em modo privacidade: sem telefone conhecido, `user.phone` some do payload.
   * O código antigo mandava `normalizePhoneNumber('...@lid')` — os dígitos do lid — e o
   * Bitrix os gravava como telefone do contato.
   */
  it('contato lid-only não manda telefone nem nome com lid', async () => {
    const { run } = buildUseCase({
      identityOverride: { identity: LID, lid: LID, phone: null },
    })
    await run(
      makeEvent({
        phone: LID,
        chatLid: LID,
        senderName: '',
        chatName: '',
        text: { message: 'hello' },
      }),
    )

    const sent = (sendMessageMock.mock.calls[0]![0] as ISendMessageData)
      .MESSAGES[0]!
    expect(sent.chat.id).toBe(LID)
    expect(sent.user).not.toHaveProperty('phone')
    expect(sent.chat.name).not.toContain('@lid')
    expect(sent.chat.name).not.toContain('3577724534928')
    expect(sent.user.name).not.toContain('@lid')
  })

  /** Sufixo do título é condicional: sem telefone, não há o que anexar. */
  it('chat.name traz o telefone só quando ele é conhecido', async () => {
    const comTelefone = buildUseCase()
    await comTelefone.run(makeEvent({ senderName: 'João' }))
    expect(
      (sendMessageMock.mock.calls[0]![0] as ISendMessageData).MESSAGES[0]!.chat
        .name,
    ).toBe('João - 5511999999999')

    sendMessageMock.mockClear()

    const semTelefone = buildUseCase({
      identityOverride: { identity: LID, lid: LID, phone: null },
    })
    await semTelefone.run(makeEvent({ senderName: 'João', phone: LID }))
    expect(
      (sendMessageMock.mock.calls[0]![0] as ISendMessageData).MESSAGES[0]!.chat
        .name,
    ).toBe('João')
  })

  /** Grupo não passa pela mudança: `resolveGroupChatId` continua como estava. */
  it('mantém o jid do grupo como identidade', async () => {
    const { run } = buildUseCase()
    await run(
      makeEvent({
        isGroup: true,
        phone: '5511999999999-group',
        text: { message: 'hello' },
      }),
    )

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.chat.id).toBe('5511999999999-group')
  })

  it('rejeita payload sem identidade em vez de abrir sessão sem dono', async () => {
    const { run, lines } = buildUseCase({
      // Payload malformado: nem telefone, nem lid em campo nenhum, e a cadeia esgotada.
      identityOverride: {
        identity: '',
        lid: null,
        phone: null,
        source: 'none',
      },
    })

    await expect(
      run(makeEvent({ phone: '', chatLid: null, text: { message: 'hello' } })),
    ).rejects.toThrow('Chat ID not found')

    expect(
      lines.some(line => line.includes('sessão de canal aberto sem dono')),
    ).toBe(true)
  })

  it('escreve contexto, linha, payload, aceite e desfecho no caminho completo', async () => {
    sendMessageMock.mockResolvedValue(withSession('1801'))
    getLastMessageIdMock.mockResolvedValue('456')

    const { run, lines } = buildUseCase()

    await run(makeEvent({ text: { message: 'mensagem secreta' } }))

    const context = lines[0]!
    expect(context).toContain('Mensagem recebida')
    expect(context).toContain('acme.bitrix24.com.br')
    expect(context).toContain('instância=INST-A')
    expect(context).toContain('5511999999999')
    expect(context).toContain('messageId=MSG-1')
    expect(context).toContain('conteúdo=TEXT')

    const resolved = lines.find(line => line.startsWith('Linha resolvida'))!
    expect(resolved).toContain('item=i1')
    expect(resolved).toContain('entitlement=active')
    expect(resolved).toContain('canal aberto=10')

    const sending = lines.find(line => line.startsWith('Entregando'))!
    expect(sending).toContain('sendMessage')
    expect(sending).toContain('CONNECTOR=thinkzap')
    expect(sending).toContain('LINE=10')

    const accepted = lines.find(line => line.startsWith('Bitrix aceitou'))!
    expect(accepted).toContain('session.CHAT_ID=1801')
    expect(accepted).toContain('bitrixMessageId=456')

    expect(lines.at(-1)).toContain('Desfecho')
    expect(lines.at(-1)).toContain('canal aberto 10')

    // O texto do contato não entra na aba; tipo e contagem de arquivos, sim.
    expect(lines.some(line => line.includes('mensagem secreta'))).toBe(false)
  })

  it('nomeia o desvio para o caminho de grupo e registra o envio de grupo', async () => {
    sendMessageMock.mockResolvedValue(withSession('1802'))

    const { run, lines } = buildUseCase()

    await run(
      makeEvent({
        isGroup: true,
        phone: '5511999999999-group',
        senderName: 'Maria',
        text: { message: 'oi' },
      }),
    )

    expect(lines[0]).toContain('grupo=sim')

    const branch = lines.find(line => line.includes('caminho de grupo'))!
    expect(branch).toContain('5511999999999-group')
    expect(branch).toContain('Maria')

    // Sem esta linha, o caminho de grupo ficava com a aba pela metade: contexto e
    // linha resolvida, e nada sobre o envio, que acontece em outro método.
    const sending = lines.find(line => line.includes('(grupo)'))!
    expect(sending).toContain('LINE=10')
    expect(sending).toContain('chat.id=5511999999999-group')

    expect(lines.at(-1)).toContain('de grupo concluída')
  })

  /** O default `noopJobLog` é o que mantém chamada fora da fila funcionando. */
  it('roda sem contexto de job e sem escrever linha nenhuma', async () => {
    const { useCase, lines } = buildUseCase()

    await expect(useCase.execute(makeEvent())).resolves.toBeUndefined()

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(lines).toEqual([])
  })

  /**
   * A leitura tardia saiu quando o domínio subiu para o topo. Se voltar, o caminho
   * completo passa a ler `core_domains` duas vezes por mensagem.
   */
  it('lê o domínio uma única vez no caminho completo', async () => {
    const { run, getDomainById } = buildUseCase()

    await run(makeEvent())

    expect(getDomainById).toHaveBeenCalledTimes(1)
  })

  /**
   * Resolver o domínio antes dos desvios não pode transformar domínio ausente em
   * falha nova: o descarte por assinatura inativa nunca dependeu dele.
   */
  it('não antecipa falha quando o domínio não é encontrado', async () => {
    const { run, lines } = buildUseCase({
      domain: null,
      subscriptionStatus: 'cancelled',
    })

    await expect(run(makeEvent())).resolves.toBeUndefined()

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(lines[0]).toContain('domínio=não resolvido')
    expect(lines.find(line => line.includes('DESCARTADA'))).toContain(
      'sem assinatura ativa',
    )
  })
})

describe('ProcessZApiInboundMessageUseCase view-once notice', () => {
  beforeEach(() => {
    sendMessageMock.mockClear().mockResolvedValue({ ok: true })
    updateMessageMock.mockClear()
    deleteMessageMock.mockClear()
    getLastMessageIdMock.mockClear().mockResolvedValue(null)
  })

  /**
   * Formato real do payload da Z-API: `viewOnce` no nível raiz do evento, sem
   * `image`/`audio`/`video`/`text` — ela não expõe a mídia de visualização única.
   *
   * Mensagem vazia não confiavelmente abre/continua a sessão do canal aberto
   * (medido em produção: `session.CHAT_ID` nunca voltou), e o aviso postado à parte
   * caiu num `bitrixChatId` de mensagem antiga, sem aparecer na sessão ativa. O
   * texto do aviso passa a ser o próprio conteúdo enviado — mesmo caminho, já
   * comprovado, de qualquer mensagem de texto.
   */
  it('usa o texto do aviso como conteúdo da mensagem para o marcador puro (payload real, sem mídia)', async () => {
    sendMessageMock.mockResolvedValueOnce({ ok: true })
    const { run } = buildUseCase()

    await run(
      makeEvent({
        viewOnce: true,
        waitingMessage: true,
        text: undefined,
      }),
    )

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.message.text).toBe(
      'Você recebeu uma mensagem de visualização única. Por motivos de ' +
        'privacidade, você só pode abrir essa mensagem no seu celular.',
    )
  })

  it('não sobrescreve o texto quando há mídia real junto do viewOnce', async () => {
    sendMessageMock.mockResolvedValueOnce({ ok: true })
    const { run } = buildUseCase()

    await run(
      makeEvent({
        image: {
          imageUrl: 'https://x/img.jpg',
          thumbnailUrl: '',
          caption: 'legenda da foto',
          mimeType: 'image/jpeg',
          viewOnce: true,
          height: 10,
          width: 10,
        },
      }),
    )

    const payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.message.text).toBe('legenda da foto')
  })

  it('não sobrescreve o texto quando viewOnce é false ou ausente', async () => {
    sendMessageMock.mockResolvedValue(withSession('1772'))
    const { run } = buildUseCase()

    await run(
      makeEvent({
        image: {
          imageUrl: 'https://x/img.jpg',
          thumbnailUrl: '',
          caption: 'legenda normal',
          mimeType: 'image/jpeg',
          viewOnce: false,
          height: 10,
          width: 10,
        },
      }),
    )
    let payload = sendMessageMock.mock.calls[0]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.message.text).toBe('legenda normal')

    await run(makeEvent())
    payload = sendMessageMock.mock.calls[1]![0] as ISendMessageData
    expect(payload.MESSAGES[0]!.message.text).toBe('mensagem')
  })

  it('document, sticker ou contact nunca viram o aviso (sem campo viewOnce)', async () => {
    sendMessageMock.mockResolvedValue(withSession('1773'))
    const { run } = buildUseCase()

    await run(
      makeEvent({
        document: {
          documentUrl: 'https://x/doc.pdf',
          fileName: 'doc.pdf',
          mimeType: 'application/pdf',
        },
      }),
    )
    await run(
      makeEvent({
        sticker: {
          stickerUrl: 'https://x/s.webp',
          mimeType: 'image/webp',
          width: 10,
          height: 10,
        },
      }),
    )
    await run(
      makeEvent({
        contact: { displayName: 'João', vCard: '', phones: ['5511999999999'] },
      }),
    )

    for (const call of sendMessageMock.mock.calls) {
      const payload = call[0] as ISendMessageData
      expect(payload.MESSAGES[0]!.message.text).not.toContain(
        'visualização única',
      )
    }
  })
})
