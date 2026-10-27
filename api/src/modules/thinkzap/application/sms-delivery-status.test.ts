import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createWorkerSourceLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { DispatchWidgetOutboxMessage } from './dispatch-widget-outbox-message'
import { ProcessHubMessageDeliveryStatusUseCase } from './process-hubmessage-delivery-status.use-case'

const row = (
  overrides: Partial<WidgetOutboxRecord> = {},
): WidgetOutboxRecord => ({
  id: 'outbox-1',
  clientMessageId: 'client-1',
  instanceId: 'inst-db-1',
  subscriptionItemId: '4821',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  destination: '5511999998888',
  text: 'Promoção até sexta',
  entity: '',
  entityId: '',
  kind: 'TEXT',
  templateName: null,
  templateLanguage: null,
  templateParameters: null,
  templateButtonParameters: null,
  templateHeaderImageUrl: null,
  buttonPayload: null,
  status: 'PENDING',
  providerMessageId: null,
  timelineNotifiedAt: null,
  attempts: 0,
  lastError: null,
  operatorBitrixUserId: null,
  smsSenderCode: 'thinkzap_sms_4821',
  smsMessageId: 'msg-1',
  origin: 'WIDGET',
  mediaType: null,
  mediaSource: null,
  fileName: null,
  caption: null,
  dispatchGroupId: null,
  partIndex: null,
  dispatchMeta: null,
  bitrixMessageId: null,
  bitrixChatId: null,
  originContext: null,
  queueSeq: null,
  cadenceWaitUntil: null,
  reprocessCount: 0,
  lastReprocessedAt: null,
  lastReprocessedBy: null,
  updatedAt: new Date(0),
  createdAt: new Date('2026-09-01T12:00:00.000Z'),
  sentAt: null,
  ...overrides,
})

const line = {
  provider: ConnectorProvider.ZAPI,
  instanceId: 'Z-1',
  zApiToken: 'TOKEN',
}

/** Erro com resposta HTTP do provider — prova que nada saiu. */
const refusedError = () =>
  new HubMessageApiError(500, 'POST', '/messages', { error: 'boom' }, null)

function makeDispatch(record: WidgetOutboxRecord, send = vi.fn()) {
  const outbox = {
    findById: vi.fn().mockResolvedValue(record),
    claimForSending: vi.fn().mockResolvedValue(true),
    markSent: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    markUnknown: vi.fn().mockResolvedValue(undefined),
    releaseToPending: vi.fn().mockResolvedValue(undefined),
    markTimelineNotified: vi.fn().mockResolvedValue(undefined),
  }

  const reportSmsStatus = vi.fn().mockResolvedValue(undefined)

  const sut = new DispatchWidgetOutboxMessage({
    outbox: outbox as never,
    senderResolver: { resolve: vi.fn().mockReturnValue({ send }) } as never,
    templateSenderResolver: {
      resolve: vi.fn().mockReturnValue({ supportsTemplateSend: true, send }),
    } as never,
    interactiveButtonSenderResolver: {
      resolve: vi.fn().mockReturnValue({ send }),
    } as never,
    messages: { create: vi.fn().mockResolvedValue(undefined) } as never,
    openChannelQueue: { enqueue: vi.fn().mockResolvedValue(undefined) },
    acquireLock: vi
      .fn()
      .mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined) }),
    notifyOutcome: vi.fn().mockResolvedValue(undefined),
    notifySent: vi.fn().mockResolvedValue(undefined),
    reportSmsStatus,
  })

  return {
    reportSmsStatus,
    outbox,
    dispatch: (isLastAttempt = false) =>
      sut.execute({ outboxId: 'outbox-1', line, isLastAttempt }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('desfecho do worker vira status no Bitrix', () => {
  it('reporta sent quando o provider aceita', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ messageId: 'prov-1', persistedType: 'TEXT' })
    const sut = makeDispatch(row(), send)

    await sut.dispatch()

    expect(sut.reportSmsStatus).toHaveBeenCalledWith(
      expect.objectContaining({ smsMessageId: 'msg-1' }),
      'sent',
    )
  })

  it('reporta failed no esgotamento das retentativas', async () => {
    const send = vi.fn().mockRejectedValue(refusedError())
    const sut = makeDispatch(row(), send)

    await sut.dispatch(true)

    expect(sut.reportSmsStatus).toHaveBeenCalledWith(
      expect.anything(),
      'failed',
    )
  })

  it('não reporta failed antes da última tentativa', async () => {
    const send = vi.fn().mockRejectedValue(refusedError())
    const sut = makeDispatch(row(), send)

    await expect(sut.dispatch(false)).rejects.toThrow()

    expect(sut.reportSmsStatus).not.toHaveBeenCalled()
  })

  it('não reporta nada em envio de widget — sem âncoras', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ messageId: 'prov-1', persistedType: 'TEXT' })
    const sut = makeDispatch(
      row({ smsSenderCode: null, smsMessageId: null }),
      send,
    )

    await sut.dispatch()

    expect(sut.reportSmsStatus).not.toHaveBeenCalled()
  })

  it('linha Z-API para em sent: nenhum delivered sai do worker', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ messageId: 'prov-1', persistedType: 'TEXT' })
    const sut = makeDispatch(row(), send)

    await sut.dispatch()

    const reported = sut.reportSmsStatus.mock.calls.map(
      ([, status]) => status as string,
    )
    expect(reported).toEqual(['sent'])
  })
})

describe('delivered e undelivered vêm do webhook da HubMessage', () => {
  const envelope = (stateName: string) =>
    ({
      message: {
        _id: 'prov-1',
        channel_id: 'C-9',
        recipient: { identifier: '5511999998888' },
        contents: [{ identifier: 'x', state: { name: stateName } }],
      },
    }) as never

  const makeUseCase = (outboxRow: WidgetOutboxRecord | null) => {
    const reportSmsStatus = vi.fn().mockResolvedValue(undefined)

    const useCase = new ProcessHubMessageDeliveryStatusUseCase({
      instanceRepo: {
        getInstanceByChannelId: vi
          .fn()
          .mockResolvedValue({ id: 'inst-db-1', domainId: 'domain-1' }),
      } as never,
      messageRepo: { findByProviderMessageId: vi.fn().mockResolvedValue(null) },
      domainRepo: { getDomainById: vi.fn().mockResolvedValue(null) },
      makeBitrixClient: vi.fn(),
      resolveBotId: vi.fn(),
      notifyOperator: vi.fn(),
      outboxRepo: {
        findByProviderMessageId: vi.fn().mockResolvedValue(outboxRow),
      },
      reportSmsStatus,
    })

    return { useCase, reportSmsStatus }
  }

  it('reporta delivered na confirmação de entrega', async () => {
    const sut = makeUseCase(row({ providerMessageId: 'prov-1' }))

    await sut.useCase.execute(envelope('READ'))

    expect(sut.reportSmsStatus).toHaveBeenCalledWith(
      expect.objectContaining({ smsMessageId: 'msg-1' }),
      'delivered',
    )
  })

  it('reporta undelivered na falha de entrega', async () => {
    const sut = makeUseCase(row({ providerMessageId: 'prov-1' }))

    await sut.useCase.execute(envelope('ERROR'))

    expect(sut.reportSmsStatus).toHaveBeenCalledWith(
      expect.anything(),
      'undelivered',
    )
  })

  it('não reporta para row sem âncoras de campanha', async () => {
    const sut = makeUseCase(
      row({
        providerMessageId: 'prov-1',
        smsSenderCode: null,
        smsMessageId: null,
      }),
    )

    await sut.useCase.execute(envelope('READ'))

    expect(sut.reportSmsStatus).not.toHaveBeenCalled()
  })

  it('não reporta quando nenhuma row do outbox casa com o id do provider', async () => {
    const sut = makeUseCase(null)

    await sut.useCase.execute(envelope('READ'))

    expect(sut.reportSmsStatus).not.toHaveBeenCalled()
  })
})
