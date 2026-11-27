import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DispatchDeps,
  DispatchOutcome,
  SettledDispatchGroup,
} from '@/modules/thinkzap/application/dispatch-widget-outbox-message'
import type { LineTargetResolution } from './widget-send-line-target'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import type { SendNotificationInput } from '@/shared/data/contracts/send-notification'

const mocks = vi.hoisted(() => ({
  findById: vi.fn<(id: string) => Promise<WidgetOutboxRecord | null>>(),
  markFailed: vi.fn<(id: string, reason: string) => Promise<void>>(),
  publish: vi.fn<(outboxId: string) => Promise<void>>(),
  notify: vi.fn<(input: SendNotificationInput) => Promise<void>>(),
  dispatchExecute: vi.fn<() => Promise<DispatchOutcome>>(),
  resolveLine: vi.fn<() => Promise<LineTargetResolution>>(),
  openChannelEnqueue: vi.fn<(job: unknown) => Promise<void>>(),
  getPhoneData: vi.fn<() => Promise<{ phone: string } | null>>(),
  dispatchDeps: { current: null as DispatchDeps | null },
}))

vi.mock('@/config/env', () => ({
  env: {
    zApi: { partnerToken: 'partner', clientToken: 'client' },
    bitrix: { connector: { code: 'hubthink_thinkzap' } },
    appCodes: { thinkzap: 'thinkzap' },
    frontUrl: '',
    logLevel: 'silent',
    nodeEnv: 'test',
  },
}))

vi.mock('@/shared/infra/logger', () => {
  const logger = () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })
  return {
    apiLogger: logger(),
    workerLogger: logger(),
    createWorkerSourceLogger: logger,
  }
})

vi.mock('@/queue/redis-connection', () => ({
  redisConnection: {},
  bullBaseOptions: {},
}))

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository',
  () => ({
    PrismaWidgetOutboxRepository: class {
      findById = mocks.findById
      markFailed = mocks.markFailed
    },
  }),
)

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-delivery-attempt.repository',
  () => ({
    PrismaDeliveryAttemptRepository: class {
      recordFailure = vi.fn(async () => {})
    },
  }),
)

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository',
  () => ({ PrismaThinkzapMessageRepository: class {} }),
)

vi.mock('./widget-send-turn-precheck', () => ({
  LineKeyMemory: class {
    remember = vi.fn()
  },
  precheckLineTurn: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('./widget-send-line-target', async importOriginal => ({
  ...(await importOriginal<typeof import('./widget-send-line-target')>()),
  resolveLineTarget: mocks.resolveLine,
}))

vi.mock('@/modules/application/main/make-get-aplication-context', () => ({
  makeGetAplicationContext: () => ({ execute: vi.fn() }),
}))

vi.mock(
  '@/modules/thinkzap/application/dispatch-widget-outbox-message',
  async importOriginal => ({
    ...(await importOriginal<
      typeof import('@/modules/thinkzap/application/dispatch-widget-outbox-message')
    >()),
    DispatchWidgetOutboxMessage: class {
      constructor(deps: DispatchDeps) {
        mocks.dispatchDeps.current = deps
      }
      execute = mocks.dispatchExecute
    },
  }),
)

vi.mock('@/modules/thinkzap/main/make-send-notice-deps', () => ({
  makePublishSendState: () => mocks.publish,
}))

vi.mock('@/modules/thinkzap/main/make-timeline-notifier', () => ({
  makeTimelineNotifier: () => ({ execute: mocks.notify }),
}))

vi.mock(
  '@/shared/infra/persistence/repositories/prisma-domain.repository',
  () => ({
    PrismaDomainRepository: class {
      getDomainById = vi.fn(() =>
        Promise.resolve({ name: 'portal.bitrix24.com.br' }),
      )
    },
  }),
)

vi.mock('@/shared/main/make-bitrix-client', () => ({
  makeBitrixClientByDomainAndAppCoode: vi.fn(() => Promise.resolve({})),
}))

vi.mock('@/modules/thinkzap/main/make-installation-locale', () => ({
  makeInstallationLocaleRepository: () => ({
    byInstallation: vi.fn(() => Promise.resolve('pt')),
  }),
}))

vi.mock(
  '@/modules/thinkzap/infra/queue/bullmq-open-channel-conversation.queue',
  () => ({
    BullMqOpenChannelConversationQueue: class {
      enqueue = mocks.openChannelEnqueue
    },
  }),
)

vi.mock('@/modules/thinkzap/infra/clients/z-api.client', () => ({
  ZApiClient: class {
    getPhoneData = mocks.getPhoneData
  },
}))

vi.mock('@/modules/thinkzap/main/make-outbound-sender-resolver', () => ({
  makeOutboundSenderResolver: () => ({}),
}))
vi.mock(
  '@/modules/thinkzap/main/connector/make-template-sender-resolver',
  () => ({ makeTemplateSenderResolver: () => ({}) }),
)
vi.mock(
  '@/modules/thinkzap/main/connector/make-interactive-button-sender-resolver',
  () => ({ makeInteractiveButtonSenderResolver: () => ({}) }),
)
vi.mock('@/modules/thinkzap/main/make-daily-send-quota', () => ({
  makeDailySendQuota: () => ({}),
}))
vi.mock('@/modules/thinkzap/main/make-send-cadence', () => ({
  makeSendCadence: () => ({}),
}))
vi.mock('@/modules/thinkzap/main/make-outbound-media-storage', () => ({
  makeOutboundMediaStorage: () => null,
}))

import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import {
  processWidgetSendJob,
  shouldPublishSendState,
} from './thinkzap-widget-send.processor'

const row = (
  overrides: Partial<WidgetOutboxRecord> = {},
): WidgetOutboxRecord => ({
  id: 'outbox-1',
  clientMessageId: 'client-1',
  instanceId: 'instance-1',
  subscriptionItemId: 'item-1',
  domainId: 'domain-1',
  appCode: 'app-1',
  destination: '5511999999999',
  text: 'Olá',
  entity: 'DEAL',
  entityId: '42',
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
  operatorBitrixUserId: '7',
  smsSenderCode: null,
  smsMessageId: null,
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
  sendNoticeId: null,
  rejectedAt: null,
  failureCode: null,
  failureReason: null,
  queueSeq: null,
  cadenceWaitUntil: null,
  reprocessCount: 0,
  lastReprocessedAt: null,
  lastReprocessedBy: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  sentAt: null,
  ...overrides,
})

/** O template de campanha de SMS: origem `WIDGET`, distinguido pelo id do SMS. */
const smsCampaignRow = () =>
  row({ smsSenderCode: 'sender', smsMessageId: 'sms-1' })

const zApiLine: LineTargetResolution = {
  kind: 'found',
  line: {
    provider: ConnectorProvider.ZAPI,
    instanceId: 'instance-1',
    zApiToken: 'token',
  },
}

const context = {
  isLastAttempt: false,
  appendJobLog: vi.fn(async () => {}),
}

/** Roda o job até o despacho e devolve as dependências que o processor montou. */
async function dispatchDepsFor(target: WidgetOutboxRecord) {
  mocks.findById.mockResolvedValue(target)
  await processWidgetSendJob({ kind: 'send', outboxId: target.id }, context)
  const deps = mocks.dispatchDeps.current
  if (!deps) throw new Error('O despacho não foi montado')
  return deps
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.dispatchDeps.current = null
  mocks.resolveLine.mockResolvedValue(zApiLine)
  mocks.dispatchExecute.mockResolvedValue({
    status: 'sent',
    providerMessageId: 'provider-1',
  })
  mocks.publish.mockResolvedValue()
  mocks.notify.mockResolvedValue()
  mocks.markFailed.mockResolvedValue()
  mocks.openChannelEnqueue.mockResolvedValue()
  mocks.getPhoneData.mockResolvedValue({ phone: '5511888888888' })
})

describe('shouldPublishSendState', () => {
  it.each([
    ['sent', true],
    ['resumed', true],
    ['failed', true],
    ['unknown', true],
    ['skipped', true],
    ['locked', false],
    ['deferred', false],
  ] as const)('%s → %s', (status, expected) => {
    expect(shouldPublishSendState(status)).toBe(expected)
  })
})

describe('processWidgetSendJob: aviso de envio', () => {
  it('publica o estado da row acompanhada depois do despacho', async () => {
    mocks.findById.mockResolvedValue(row())

    await processWidgetSendJob({ kind: 'send', outboxId: 'outbox-1' }, context)

    expect(mocks.publish).toHaveBeenCalledWith('outbox-1')
    expect(mocks.publish.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.dispatchExecute.mock.invocationCallOrder[0]!,
    )
  })

  it('publica a row reprocessada que o despacho pulou por já ser terminal', async () => {
    mocks.findById.mockResolvedValue(row({ status: 'FAILED' }))
    mocks.dispatchExecute.mockResolvedValue({
      status: 'skipped',
      reason: 'terminal',
    })

    await processWidgetSendJob({ kind: 'send', outboxId: 'outbox-1' }, context)

    expect(mocks.publish).toHaveBeenCalledWith('outbox-1')
  })

  it('não publica quando o despacho só adiou', async () => {
    mocks.findById.mockResolvedValue(row())
    mocks.dispatchExecute.mockResolvedValue({ status: 'locked' })

    const outcome = await processWidgetSendJob(
      { kind: 'send', outboxId: 'outbox-1' },
      context,
    )

    expect(outcome).toBe('reschedule')
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it.each([
    ['campanha de SMS', smsCampaignRow()],
    ['resposta do operador', row({ origin: 'OPERATOR' })],
    ['fala do bot', row({ origin: 'BOT' })],
  ])('não publica para %s', async (_, target) => {
    mocks.findById.mockResolvedValue(target)

    await processWidgetSendJob({ kind: 'send', outboxId: target.id }, context)

    expect(mocks.publish).not.toHaveBeenCalled()
  })
})

describe('notifySent', () => {
  it('row do widget não publica o comentário antigo', async () => {
    const target = row({ status: 'SENT' })
    const deps = await dispatchDepsFor(target)

    await deps.notifySent(target)

    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it('campanha de SMS publica o comentário como antes', async () => {
    const target = smsCampaignRow()
    const deps = await dispatchDepsFor(target)

    await deps.notifySent(target)

    expect(mocks.notify).toHaveBeenCalledTimes(1)
    expect(mocks.notify.mock.calls[0]![0]).toMatchObject({
      contextId: '42',
      entity: 'DEAL',
      authorBitrixUserId: '7',
    })
  })
})

describe('notifyOutcome', () => {
  it.each(['failed', 'unknown', 'daily-limit'] as const)(
    'row do widget não comenta o desfecho %s',
    async outcome => {
      const target = row({ origin: 'ROBOT_TEMPLATE' })
      const deps = await dispatchDepsFor(target)

      await deps.notifyOutcome(outcome, target)

      expect(mocks.notify).not.toHaveBeenCalled()
    },
  )

  it('campanha de SMS comenta o limite diário como antes', async () => {
    const target = smsCampaignRow()
    const deps = await dispatchDepsFor(target)

    await deps.notifyOutcome('daily-limit', target)

    expect(mocks.notify).toHaveBeenCalledTimes(1)
  })
})

describe('linha não resolvida', () => {
  it('row acompanhada: marca falha, publica o estado e não comenta', async () => {
    mocks.findById.mockResolvedValue(row())
    mocks.resolveLine.mockResolvedValue({ kind: 'not-found' })

    await processWidgetSendJob({ kind: 'send', outboxId: 'outbox-1' }, context)

    expect(mocks.markFailed).toHaveBeenCalledTimes(1)
    expect(mocks.publish).toHaveBeenCalledWith('outbox-1')
    expect(mocks.publish.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.markFailed.mock.invocationCallOrder[0]!,
    )
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it('campanha de SMS: comenta a falha como antes e não publica', async () => {
    mocks.findById.mockResolvedValue(smsCampaignRow())
    mocks.resolveLine.mockResolvedValue({ kind: 'not-found' })

    await processWidgetSendJob({ kind: 'send', outboxId: 'outbox-1' }, context)

    expect(mocks.notify).toHaveBeenCalledTimes(1)
    expect(mocks.publish).not.toHaveBeenCalled()
  })
})

describe('grupo concluído', () => {
  const part = (
    overrides: Partial<SettledDispatchGroup['parts'][number]> = {},
  ): SettledDispatchGroup['parts'][number] => ({
    id: 'outbox-1',
    partIndex: 0,
    destination: '5511999999999',
    kind: 'TEXT',
    mediaType: null,
    fileName: null,
    status: 'SENT',
    lastError: null,
    dispatchMeta: null,
    text: 'Olá',
    providerMessageId: 'provider-1',
    mediaSource: null,
    ...overrides,
  })

  it('robô "Enviar mensagem": abre a conversa e não comenta', async () => {
    const first = row({
      origin: 'ROBOT_MESSAGE',
      status: 'SENT',
      dispatchGroupId: 'group-1',
      partIndex: 0,
      dispatchMeta: {
        kind: 'robot-message',
        fromPhone: '5511888888888',
        message: 'Olá',
        requestedFiles: 0,
        failedFiles: [],
        recipients: ['5511999999999'],
        crmDocument: { entity: 'DEAL', entityId: '42' },
      },
    })
    const deps = await dispatchDepsFor(first)

    await deps.onGroupSettled?.({
      dispatchGroupId: 'group-1',
      first,
      parts: [part()],
    })

    expect(mocks.openChannelEnqueue).toHaveBeenCalledTimes(1)
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it('anexos do widget entregues: abre a conversa, não comenta nem lê a linha', async () => {
    const first = row({
      origin: 'WIDGET_ATTACHMENT',
      status: 'SENT',
      dispatchGroupId: 'group-1',
      partIndex: 0,
      dispatchMeta: {
        kind: 'widget-attachment',
        message: 'Olá',
        attachmentKinds: ['image'],
      },
    })
    const deps = await dispatchDepsFor(first)

    await deps.onGroupSettled?.({
      dispatchGroupId: 'group-1',
      first,
      parts: [part()],
    })

    expect(mocks.openChannelEnqueue).toHaveBeenCalledTimes(1)
    expect(mocks.notify).not.toHaveBeenCalled()
    expect(mocks.getPhoneData).not.toHaveBeenCalled()
  })

  it('anexos do widget sem nada entregue: não comenta', async () => {
    const first = row({
      origin: 'WIDGET_ATTACHMENT',
      status: 'FAILED',
      dispatchGroupId: 'group-1',
      partIndex: 0,
    })
    const deps = await dispatchDepsFor(first)

    await deps.onGroupSettled?.({
      dispatchGroupId: 'group-1',
      first,
      parts: [part({ status: 'FAILED', providerMessageId: null })],
    })

    expect(mocks.notify).not.toHaveBeenCalled()
  })
})
