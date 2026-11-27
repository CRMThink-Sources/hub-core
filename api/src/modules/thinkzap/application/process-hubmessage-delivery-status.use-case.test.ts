import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { HubMessageStatusEnvelope } from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  ProcessHubMessageDeliveryStatusUseCase,
  type ProcessHubMessageDeliveryStatusDeps,
} from './process-hubmessage-delivery-status.use-case'
import type { ProgressResult } from './record-delivery-progress'
import type { RejectionResult } from './record-delivery-rejection'

const CHANNEL_ID = '40A14E4772D74EB78957CF0E407E695C'
const PROVIDER_MESSAGE_ID = '01A015EEAFCA741A85FDD86E205BDD18'

const DISPLAY_NAME_FAILURE =
  'Integration with meta-whatsapp failed (HTTP 400): {"messaging_product":"whatsapp","details":"WhatsApp provided number needs display name approval before message can be sent."}'

/**
 * Payload real de recusa (2026-08-18), reduzido ao que o use case lê.
 *
 * `extra` existe para o segundo formato de recusa (2026-08-30), em que
 * `failedDescription` vem nulo e o motivo chega em
 * `external_information.errors[]` — o item de estado carrega os dois.
 */
function makeEnvelope(
  state: Record<string, unknown> = {
    '@class': '.Failed',
    name: 'ERROR',
    failedDescription: DISPLAY_NAME_FAILURE,
  },
  extra: Record<string, unknown> = {},
): HubMessageStatusEnvelope {
  return {
    message: {
      _id: PROVIDER_MESSAGE_ID,
      channel_id: CHANNEL_ID,
      recipient: { identifier: '554388092447', name: '554388092447' },
      contents: [
        {
          identifier: '01A015EEB14273958125503BA647334C',
          moment: 1787074359618,
          phone: '554388092447',
          type: 'ErrorCallback',
          internal_information: { integration_id: PROVIDER_MESSAGE_ID },
          ...extra,
          state,
        },
      ],
    },
  } as HubMessageStatusEnvelope
}

const outboundMessage = {
  id: 'msg-1',
  instanceId: 'inst-db-1',
  source: 'BITRIX' as const,
  providerMessageId: PROVIDER_MESSAGE_ID,
  bitrixMessageId: 'BITRIX-MSG-1',
  bitrixChatId: '100',
  type: 'TEXT' as const,
  text: 'oi',
  fileName: null,
  chatId: '554388092447',
  createdAt: new Date(0),
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  const bitrixClient = { callMethod: vi.fn() } as unknown as BitrixClient

  const deps = {
    instanceRepo: {
      getInstanceByChannelId: vi
        .fn()
        .mockResolvedValue({ id: 'inst-db-1', domainId: 'domain-1' }),
    },
    messageRepo: {
      findByProviderMessageId: vi.fn().mockResolvedValue(outboundMessage),
    },
    domainRepo: {
      getDomainById: vi
        .fn()
        .mockResolvedValue({ id: 'domain-1', name: 'acme.bitrix24.com' }),
    },
    makeBitrixClient: vi.fn().mockResolvedValue(bitrixClient),
    resolveBotId: vi.fn().mockResolvedValue(1958),
    notifyOperator: vi.fn().mockResolvedValue({
      posted: true,
      bitrixMessageId: '4242',
      method: 'im.message.add',
    }),
    ...overrides,
  }

  return {
    deps,
    bitrixClient,
    useCase: new ProcessHubMessageDeliveryStatusUseCase(
      deps as unknown as ConstructorParameters<
        typeof ProcessHubMessageDeliveryStatusUseCase
      >[0],
    ),
  }
}

/**
 * Tipado com a assinatura do port: `vi.fn()` cru infere `Procedure | Constructable` e
 * não casa com `AppendJobLog` no `tsc`.
 */
function makeAppendJobLogMock() {
  return vi.fn(async (_line: string): Promise<void> => {})
}

describe('ProcessHubMessageDeliveryStatusUseCase', () => {
  let appendJobLog: ReturnType<typeof makeAppendJobLogMock>

  beforeEach(() => {
    appendJobLog = makeAppendJobLogMock()
  })

  function jobLogLines() {
    return appendJobLog.mock.calls.map(([line]) => line)
  }

  it('recusa da Meta avisa o operador no chat do canal aberto', async () => {
    const { useCase, deps, bitrixClient } = makeDeps()

    await useCase.execute(makeEnvelope(), { appendJobLog })

    expect(deps.messageRepo.findByProviderMessageId).toHaveBeenCalledWith(
      'inst-db-1',
      PROVIDER_MESSAGE_ID,
    )
    expect(deps.notifyOperator).toHaveBeenCalledWith(
      bitrixClient,
      1958,
      '100',
      expect.stringContaining('nome de exibição'),
    )
    // O cru do provider fica na aba Logs mesmo quando a tradução casou.
    expect(jobLogLines().some(l => l.includes('display name approval'))).toBe(
      true,
    )
    // A aba só afirma "postado" com o id de mensagem que o Bitrix devolveu...
    expect(jobLogLines().some(l => l.includes('mensagem 4242'))).toBe(true)
    // ...e diz por QUAL método passou: bot e usuário do app são candidatos distintos,
    // e qual funciona depende do portal.
    expect(jobLogLines().some(l => l.includes('via im.message.add'))).toBe(true)
  })

  /**
   * O caso do log de produção: `imbot.message.add` respondeu, o worker disse "aviso
   * postado" e o chat ficou vazio. A aba Logs precisa dizer que o Bitrix recusou —
   * senão manda procurar no Bitrix uma mensagem que nunca existiu.
   */
  it('Bitrix recusando o aviso aparece como recusa na aba Logs', async () => {
    const { useCase } = makeDeps({
      notifyOperator: vi
        .fn()
        .mockResolvedValue({ posted: false, reason: 'BOT_ID_ERROR' }),
    })

    await useCase.execute(makeEnvelope(), { appendJobLog })

    const lines = jobLogLines()
    expect(lines.some(l => l.includes('NÃO criou'))).toBe(true)
    expect(lines.some(l => l.includes('BOT_ID_ERROR'))).toBe(true)
    expect(lines.some(l => l.includes('Aviso postado'))).toBe(false)
  })

  it('canal desconhecido encerra sem erro e sem avisar', async () => {
    const { useCase, deps } = makeDeps({
      instanceRepo: { getInstanceByChannelId: vi.fn().mockResolvedValue(null) },
    })

    await expect(
      useCase.execute(makeEnvelope(), { appendJobLog }),
    ).resolves.toBeUndefined()

    expect(deps.notifyOperator).not.toHaveBeenCalled()
    expect(jobLogLines().some(l => l.includes('Nenhuma instância'))).toBe(true)
  })

  it('mensagem ainda não persistida encerra sem avisar', async () => {
    const { useCase, deps } = makeDeps({
      messageRepo: { findByProviderMessageId: vi.fn().mockResolvedValue(null) },
    })

    await useCase.execute(makeEnvelope(), { appendJobLog })

    expect(deps.notifyOperator).not.toHaveBeenCalled()
    expect(jobLogLines().some(l => l.includes('não encontrada no banco'))).toBe(
      true,
    )
  })

  it('mensagem que não saiu do canal aberto é ignorada', async () => {
    const { useCase, deps } = makeDeps({
      messageRepo: {
        findByProviderMessageId: vi
          .fn()
          .mockResolvedValue({ ...outboundMessage, source: 'HUBMESSAGE' }),
      },
    })

    await useCase.execute(makeEnvelope(), { appendJobLog })

    expect(deps.notifyOperator).not.toHaveBeenCalled()
    expect(jobLogLines().some(l => l.includes('source=HUBMESSAGE'))).toBe(true)
  })

  it('estado de sucesso não posta nada no canal aberto', async () => {
    const { useCase, deps } = makeDeps()

    await useCase.execute(
      makeEnvelope({ '@class': '.Sent', name: 'DELIVERED' }),
      { appendJobLog },
    )

    expect(deps.notifyOperator).not.toHaveBeenCalled()
    expect(deps.makeBitrixClient).not.toHaveBeenCalled()
    expect(jobLogLines().some(l => l.includes('não é recusa'))).toBe(true)
  })

  it('mensagem sem bitrixChatId não tem chat para avisar', async () => {
    const { useCase, deps } = makeDeps({
      messageRepo: {
        findByProviderMessageId: vi
          .fn()
          .mockResolvedValue({ ...outboundMessage, bitrixChatId: null }),
      },
    })

    await useCase.execute(makeEnvelope(), { appendJobLog })

    expect(deps.notifyOperator).not.toHaveBeenCalled()
    expect(jobLogLines().some(l => l.includes('bitrixChatId'))).toBe(true)
  })

  /**
   * Retentar não muda o desfecho da mensagem — falhar aqui só faria a fila reprocessar
   * até desistir, com o mesmo resultado.
   */
  it('falha ao montar o cliente Bitrix não propaga', async () => {
    const { useCase } = makeDeps({
      makeBitrixClient: vi.fn().mockRejectedValue(new Error('credencial fora')),
    })

    await expect(
      useCase.execute(makeEnvelope(), { appendJobLog }),
    ).resolves.toBeUndefined()

    expect(
      jobLogLines().some(l => l.includes('Falha ao preparar o aviso')),
    ).toBe(true)
  })

  it('portal não encontrado encerra sem avisar', async () => {
    const { useCase, deps } = makeDeps({
      domainRepo: { getDomainById: vi.fn().mockResolvedValue(null) },
    })

    await useCase.execute(makeEnvelope(), { appendJobLog })

    expect(deps.notifyOperator).not.toHaveBeenCalled()
    expect(jobLogLines().some(l => l.includes('não encontrado'))).toBe(true)
  })

  /**
   * O caso de 2026-08-30 (traceKey b6758d52-6ce8-40fd-9d25-c59235bc07b1): a Meta
   * explicou o motivo em `errors[]` e `failedDescription` veio nulo. O aviso antigo
   * dizia "não informou o motivo. Verifique a conexão da linha".
   */
  it('janela de 24h vinda de errors[] avisa a janela e registra o código', async () => {
    const { useCase, deps } = makeDeps()

    await useCase.execute(
      makeEnvelope(
        { '@class': '.Failed', name: 'ERROR', failedDescription: null },
        {
          external_information: {
            errors: [
              {
                code: '131047',
                title: 'Re-engagement message',
                message: 'Re-engagement message',
                error_data: {
                  details:
                    'Message failed to send because more than 24 hours have passed since the customer last replied to this number.',
                },
              },
            ],
          },
        },
      ),
      { appendJobLog },
    )

    expect(deps.notifyOperator).toHaveBeenCalledWith(
      expect.anything(),
      1958,
      '100',
      expect.stringContaining('24 horas'),
    )
    const notice = deps.notifyOperator.mock.calls[0]?.[3] as string
    expect(notice).toContain('template')
    expect(notice).not.toContain('não informou o motivo')
    expect(jobLogLines().some(l => l.includes('código Meta: 131047'))).toBe(
      true,
    )
    expect(
      jobLogLines().some(l => l.includes('more than 24 hours have passed')),
    ).toBe(true)
  })

  it('erro desconhecido leva o retorno cru ao aviso', async () => {
    const { useCase, deps } = makeDeps()

    await useCase.execute(
      makeEnvelope({
        '@class': '.Failed',
        name: 'ERROR',
        failedDescription: 'HTTP 500: internal gremlins',
      }),
      { appendJobLog },
    )

    expect(deps.notifyOperator).toHaveBeenCalledWith(
      expect.anything(),
      1958,
      '100',
      expect.stringContaining('internal gremlins'),
    )
  })
})

describe('ProcessHubMessageDeliveryStatusUseCase idioma do aviso', () => {
  const noticeOf = (deps: ReturnType<typeof makeDeps>['deps']) =>
    (deps.notifyOperator as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[3] as string

  it('instalação em espanhol: aviso de nome de exibição em espanhol', async () => {
    const resolveLocale = vi.fn().mockResolvedValue('es')
    const { useCase, deps } = makeDeps({ resolveLocale })

    await useCase.execute(makeEnvelope(), {
      appendJobLog: vi.fn(async () => {}),
    })

    expect(resolveLocale).toHaveBeenCalledOnce()
    expect(noticeOf(deps)).toContain('Su mensaje no fue entregado')
    expect(noticeOf(deps)).toContain('nombre visible')
  })

  it('genérica em inglês preserva o retorno do provedor', async () => {
    const { useCase, deps } = makeDeps({
      resolveLocale: vi.fn().mockResolvedValue('en'),
    })

    await useCase.execute(
      makeEnvelope({
        '@class': '.Failed',
        name: 'ERROR',
        failedDescription: 'algo inédito do provedor xyz',
      }),
      { appendJobLog: vi.fn(async () => {}) },
    )

    expect(noticeOf(deps)).toContain('WhatsApp Official declined the message')
    expect(noticeOf(deps)).toContain('algo inédito do provedor xyz')
  })

  it('sem resolver de idioma: português, como hoje', async () => {
    const { useCase, deps } = makeDeps()

    await useCase.execute(makeEnvelope(), {
      appendJobLog: vi.fn(async () => {}),
    })

    expect(noticeOf(deps)).toContain('Sua mensagem não foi entregue')
  })
})

describe('ProcessHubMessageDeliveryStatusUseCase registro da recusa', () => {
  const appendJobLog = async () => {}

  function makeRecordingDeps(
    result: RejectionResult = 'recorded',
    overrides: Partial<ProcessHubMessageDeliveryStatusDeps> = {},
  ) {
    const recording = {
      recordRejection: vi
        .fn<
          NonNullable<ProcessHubMessageDeliveryStatusDeps['recordRejection']>
        >()
        .mockResolvedValue(result),
      retryRecording: vi
        .fn<
          NonNullable<ProcessHubMessageDeliveryStatusDeps['retryRecording']>
        >()
        .mockResolvedValue(),
      outboxRepo: {
        findByProviderMessageId: vi.fn().mockResolvedValue({
          smsSenderCode: 'thinkzap_sms_4821',
          smsMessageId: 'sms-1',
        }),
      },
      reportSmsStatus: vi.fn().mockResolvedValue(undefined),
    }

    return { ...makeDeps({ ...recording, ...overrides }), recording }
  }

  it('recusa registra o envio e segue avisando o chat', async () => {
    const { useCase, deps, recording } = makeRecordingDeps()
    const envelope = makeEnvelope()

    await useCase.execute(envelope, { appendJobLog })

    expect(recording.recordRejection).toHaveBeenCalledWith({
      instanceId: 'inst-db-1',
      providerMessageId: PROVIDER_MESSAGE_ID,
      stateItem: envelope.message.contents[0],
    })
    expect(recording.retryRecording).not.toHaveBeenCalled()
    expect(deps.notifyOperator).toHaveBeenCalledOnce()
    expect(recording.reportSmsStatus).toHaveBeenCalledOnce()
  })

  /** Campanha e robô não gravam mensagem do canal aberto: o registro vem antes. */
  it('registra mesmo sem mensagem do canal aberto', async () => {
    const { useCase, recording } = makeRecordingDeps('recorded', {
      messageRepo: { findByProviderMessageId: vi.fn().mockResolvedValue(null) },
    })

    await useCase.execute(makeEnvelope(), { appendJobLog })

    expect(recording.recordRejection).toHaveBeenCalledOnce()
  })

  it('estado sem erro não grava recusa', async () => {
    const { useCase, recording } = makeRecordingDeps()

    await useCase.execute(
      makeEnvelope({ '@class': '.Sent', name: 'DELIVERED' }),
      { appendJobLog },
    )

    expect(recording.recordRejection).not.toHaveBeenCalled()
    expect(recording.retryRecording).not.toHaveBeenCalled()
  })

  it('row ausente agenda a tentativa 1', async () => {
    const { useCase, recording } = makeRecordingDeps('row-missing')
    const envelope = makeEnvelope()

    await useCase.execute(envelope, { appendJobLog })

    expect(recording.retryRecording).toHaveBeenCalledWith(envelope, 1)
  })

  it('row ainda ausente na tentativa 4 agenda a 5', async () => {
    const { useCase, recording } = makeRecordingDeps('row-missing')
    const envelope = makeEnvelope()

    await useCase.execute(envelope, { appendJobLog, recordOnlyAttempt: 4 })

    expect(recording.retryRecording).toHaveBeenCalledWith(envelope, 5)
  })

  it('tentativa 5 não agenda outra e encerra sem erro', async () => {
    const { useCase, recording } = makeRecordingDeps('row-missing')

    await expect(
      useCase.execute(makeEnvelope(), { appendJobLog, recordOnlyAttempt: 5 }),
    ).resolves.toBeUndefined()

    expect(recording.retryRecording).not.toHaveBeenCalled()
  })

  it.each(['recorded', 'row-missing'] as const)(
    'execução só de registro (%s) não avisa o chat nem reporta campanha',
    async result => {
      const { useCase, deps, recording } = makeRecordingDeps(result)

      await useCase.execute(makeEnvelope(), {
        appendJobLog,
        recordOnlyAttempt: 1,
      })

      expect(recording.recordRejection).toHaveBeenCalledOnce()
      expect(deps.notifyOperator).not.toHaveBeenCalled()
      expect(deps.messageRepo.findByProviderMessageId).not.toHaveBeenCalled()
      expect(recording.reportSmsStatus).not.toHaveBeenCalled()
    },
  )

  it('erro no registro não impede o aviso ao chat', async () => {
    const { useCase, deps } = makeRecordingDeps('recorded', {
      recordRejection: vi
        .fn<
          NonNullable<ProcessHubMessageDeliveryStatusDeps['recordRejection']>
        >()
        .mockRejectedValue(new Error('banco fora')),
    })

    await expect(
      useCase.execute(makeEnvelope(), { appendJobLog }),
    ).resolves.toBeUndefined()

    expect(deps.notifyOperator).toHaveBeenCalledOnce()
  })

  it('erro ao agendar a nova tentativa não impede o aviso ao chat', async () => {
    const { useCase, deps } = makeRecordingDeps('row-missing', {
      retryRecording: vi
        .fn<
          NonNullable<ProcessHubMessageDeliveryStatusDeps['retryRecording']>
        >()
        .mockRejectedValue(new Error('redis fora')),
    })

    await expect(
      useCase.execute(makeEnvelope(), { appendJobLog }),
    ).resolves.toBeUndefined()

    expect(deps.notifyOperator).toHaveBeenCalledOnce()
  })

  it('erro ao gravar agenda a tentativa 1', async () => {
    const { useCase, recording } = makeRecordingDeps('recorded', {
      recordRejection: vi
        .fn<
          NonNullable<ProcessHubMessageDeliveryStatusDeps['recordRejection']>
        >()
        .mockRejectedValue(new Error('banco fora')),
    })
    const envelope = makeEnvelope()

    await useCase.execute(envelope, { appendJobLog })

    expect(recording.retryRecording).toHaveBeenCalledWith(envelope, 1)
  })

  it('erro ao gravar na tentativa 5 não agenda e não lança', async () => {
    const { useCase, recording } = makeRecordingDeps('recorded', {
      recordRejection: vi
        .fn<
          NonNullable<ProcessHubMessageDeliveryStatusDeps['recordRejection']>
        >()
        .mockRejectedValue(new Error('banco fora')),
    })

    await expect(
      useCase.execute(makeEnvelope(), { appendJobLog, recordOnlyAttempt: 5 }),
    ).resolves.toBeUndefined()

    expect(recording.retryRecording).not.toHaveBeenCalled()
  })

  it('execução só de registro que lança não avisa o chat nem reporta campanha', async () => {
    const { useCase, deps, recording } = makeRecordingDeps('recorded', {
      recordRejection: vi
        .fn<
          NonNullable<ProcessHubMessageDeliveryStatusDeps['recordRejection']>
        >()
        .mockRejectedValue(new Error('banco fora')),
    })

    await useCase.execute(makeEnvelope(), {
      appendJobLog,
      recordOnlyAttempt: 2,
    })

    expect(deps.notifyOperator).not.toHaveBeenCalled()
    expect(recording.reportSmsStatus).not.toHaveBeenCalled()
  })
})

describe('ProcessHubMessageDeliveryStatusUseCase registro de Entregue e Lido', () => {
  const appendJobLog = async () => {}

  /** Amostras reais: `moment` em segundos, tipo de callback próprio de cada estado. */
  function makeProgressEnvelope(name: 'RECEIVED' | 'READ') {
    return makeEnvelope(
      { name },
      {
        moment: 1795600000,
        type: name === 'READ' ? 'MessageStatusCallback' : 'DeliveryCallback',
      },
    )
  }

  function makeProgressDeps(
    result: ProgressResult = 'recorded',
    overrides: Partial<ProcessHubMessageDeliveryStatusDeps> = {},
  ) {
    const recording = {
      recordProgress: vi
        .fn<
          NonNullable<ProcessHubMessageDeliveryStatusDeps['recordProgress']>
        >()
        .mockResolvedValue(result),
      recordRejection: vi
        .fn<
          NonNullable<ProcessHubMessageDeliveryStatusDeps['recordRejection']>
        >()
        .mockResolvedValue('recorded'),
      retryRecording: vi
        .fn<
          NonNullable<ProcessHubMessageDeliveryStatusDeps['retryRecording']>
        >()
        .mockResolvedValue(),
      outboxRepo: {
        findByProviderMessageId: vi.fn().mockResolvedValue({
          smsSenderCode: 'thinkzap_sms_4821',
          smsMessageId: 'sms-1',
        }),
      },
      reportSmsStatus: vi.fn().mockResolvedValue(undefined),
    }

    return { ...makeDeps({ ...recording, ...overrides }), recording }
  }

  it('RECEIVED registra a entrega e segue para a campanha como hoje', async () => {
    const { useCase, deps, recording } = makeProgressDeps()
    const envelope = makeProgressEnvelope('RECEIVED')

    await useCase.execute(envelope, { appendJobLog })

    expect(recording.recordProgress).toHaveBeenCalledWith({
      instanceId: 'inst-db-1',
      providerMessageId: PROVIDER_MESSAGE_ID,
      stateItem: envelope.message.contents[0],
    })
    expect(recording.recordRejection).not.toHaveBeenCalled()
    expect(recording.retryRecording).not.toHaveBeenCalled()
    expect(recording.reportSmsStatus).toHaveBeenCalledWith(
      expect.anything(),
      'delivered',
    )
    expect(deps.notifyOperator).not.toHaveBeenCalled()
  })

  it('estado que não é progresso nem recusa não registra nada', async () => {
    const { useCase, recording } = makeProgressDeps()

    await useCase.execute(makeEnvelope({ name: 'SENT' }), { appendJobLog })

    expect(recording.recordProgress).not.toHaveBeenCalled()
    expect(recording.recordRejection).not.toHaveBeenCalled()
  })

  it('recusa continua indo só para o registro de recusa', async () => {
    const { useCase, recording } = makeProgressDeps()

    await useCase.execute(makeEnvelope(), { appendJobLog })

    expect(recording.recordRejection).toHaveBeenCalledOnce()
    expect(recording.recordProgress).not.toHaveBeenCalled()
  })

  it('row ausente agenda a tentativa 1', async () => {
    const { useCase, recording } = makeProgressDeps('row-missing')
    const envelope = makeProgressEnvelope('READ')

    await useCase.execute(envelope, { appendJobLog })

    expect(recording.retryRecording).toHaveBeenCalledWith(envelope, 1)
  })

  it('row ainda ausente na tentativa 1 agenda a 2', async () => {
    const { useCase, recording } = makeProgressDeps('row-missing')
    const envelope = makeProgressEnvelope('READ')

    await useCase.execute(envelope, { appendJobLog, recordOnlyAttempt: 1 })

    expect(recording.retryRecording).toHaveBeenCalledWith(envelope, 2)
  })

  /** Envio que não passou pelo outbox (resposta do operador, bot) para aqui. */
  it('tentativa 2 não agenda outra e encerra sem erro', async () => {
    const { useCase, recording } = makeProgressDeps('row-missing')

    await expect(
      useCase.execute(makeProgressEnvelope('READ'), {
        appendJobLog,
        recordOnlyAttempt: 2,
      }),
    ).resolves.toBeUndefined()

    expect(recording.retryRecording).not.toHaveBeenCalled()
  })

  it('erro ao gravar reagenda e não lança', async () => {
    const { useCase, recording } = makeProgressDeps('recorded', {
      recordProgress: vi
        .fn<
          NonNullable<ProcessHubMessageDeliveryStatusDeps['recordProgress']>
        >()
        .mockRejectedValue(new Error('banco fora')),
    })
    const envelope = makeProgressEnvelope('RECEIVED')

    await expect(
      useCase.execute(envelope, { appendJobLog }),
    ).resolves.toBeUndefined()

    expect(recording.retryRecording).toHaveBeenCalledWith(envelope, 1)
    expect(recording.reportSmsStatus).toHaveBeenCalledOnce()
  })

  it('execução só de registro de um READ não avisa o chat nem reporta campanha', async () => {
    const { useCase, deps, recording } = makeProgressDeps('recorded')

    await useCase.execute(makeProgressEnvelope('READ'), {
      appendJobLog,
      recordOnlyAttempt: 1,
    })

    expect(recording.recordProgress).toHaveBeenCalledOnce()
    expect(recording.recordRejection).not.toHaveBeenCalled()
    expect(deps.notifyOperator).not.toHaveBeenCalled()
    expect(deps.messageRepo.findByProviderMessageId).not.toHaveBeenCalled()
    expect(recording.reportSmsStatus).not.toHaveBeenCalled()
  })
})
