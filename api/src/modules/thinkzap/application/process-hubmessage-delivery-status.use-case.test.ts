import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { HubMessageStatusEnvelope } from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ProcessHubMessageDeliveryStatusUseCase } from './process-hubmessage-delivery-status.use-case'

const CHANNEL_ID = '40A14E4772D74EB78957CF0E407E695C'
const PROVIDER_MESSAGE_ID = '01A015EEAFCA741A85FDD86E205BDD18'

const DISPLAY_NAME_FAILURE =
  'Integration with meta-whatsapp failed (HTTP 400): {"messaging_product":"whatsapp","details":"WhatsApp provided number needs display name approval before message can be sent."}'

/** Payload real de recusa (2026-08-18), reduzido ao que o use case lê. */
function makeEnvelope(
  state: Record<string, unknown> = {
    '@class': '.Failed',
    name: 'ERROR',
    failedDescription: DISPLAY_NAME_FAILURE,
  },
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
