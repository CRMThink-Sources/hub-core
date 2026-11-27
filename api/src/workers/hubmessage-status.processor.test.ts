import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProcessHubMessageDeliveryStatusDeps } from '@/modules/thinkzap/application/process-hubmessage-delivery-status.use-case'
import type { HubMessageStatusEnvelope } from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'

const m = vi.hoisted(() => ({
  deps: undefined as unknown,
  execute: vi.fn().mockResolvedValue(undefined),
  enqueue: vi.fn().mockResolvedValue(undefined),
}))

vi.mock(
  '@/modules/thinkzap/application/process-hubmessage-delivery-status.use-case',
  () => ({
    ProcessHubMessageDeliveryStatusUseCase: class {
      execute = m.execute
      constructor(deps: unknown) {
        m.deps = deps
      }
    },
  }),
)
vi.mock('@/queue/thinkzap-inbound.queue', () => ({
  enqueueThinkzapInboundJob: m.enqueue,
}))
vi.mock('@/config/env', () => ({ env: { appCodes: { thinkzap: 'tz' } } }))
vi.mock('@/queue/redis-connection', () => ({ redisConnection: {} }))
vi.mock('@/shared/infra/logger', () => ({
  createWorkerSourceLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))
vi.mock('@/modules/thinkzap/application/ensure-bitrix-bot-id', () => ({
  ensureBitrixBotId: vi.fn(),
}))
vi.mock(
  '@/modules/thinkzap/application/notify-operator-delivery-failed',
  () => ({ notifyOperatorDeliveryFailed: vi.fn() }),
)
vi.mock('@/modules/thinkzap/application/report-sms-message-status', () => ({
  reportSmsMessageStatus: vi.fn(),
}))
vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository',
  () => ({ PrismaInstanceRepository: class {} }),
)
vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository',
  () => ({ PrismaThinkzapMessageRepository: class {} }),
)
vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository',
  () => ({ PrismaWidgetOutboxRepository: class {} }),
)
vi.mock(
  '@/shared/infra/persistence/repositories/prisma-domain.repository',
  () => ({ PrismaDomainRepository: class {} }),
)
vi.mock('@/shared/app-catalog/app-catalog', () => ({
  thinkzapAppCodeId: () => 'app-1',
}))
vi.mock('@/modules/thinkzap/main/make-installation-locale', () => ({
  makeInstallationLocaleRepository: vi.fn(),
}))
vi.mock('@/modules/thinkzap/main/make-send-notice-deps', () => ({
  makePublishSendState: () => vi.fn(),
}))
vi.mock('@/shared/main/make-bitrix-client', () => ({
  makeBitrixClientByDomainAndAppCoode: vi.fn(),
}))

import { processHubMessageDeliveryStatus } from './hubmessage-status.processor'

/** `_id` com `:` de propósito: o BullMQ recusa o caractere em jobId custom. */
const envelope: HubMessageStatusEnvelope = {
  message: {
    _id: 'prov:1',
    channel_id: 'C-9',
    contents: [{ type: 'ErrorCallback', state: { name: 'ERROR' } }],
  },
}

const retryRecording = () =>
  (m.deps as ProcessHubMessageDeliveryStatusDeps).retryRecording!

const recordProgress = () =>
  (m.deps as ProcessHubMessageDeliveryStatusDeps).recordProgress

describe('processHubMessageDeliveryStatus nova tentativa de registro', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    [1, 10_000],
    [5, 300_000],
  ])(
    'tentativa %i entra na fila com espera de %i ms e jobId sem dois-pontos',
    async (nextAttempt, delay) => {
      await processHubMessageDeliveryStatus(envelope, {
        appendJobLog: async () => {},
        traceKey: 'trace-1',
      })

      await retryRecording()(envelope, nextAttempt)

      expect(m.enqueue).toHaveBeenCalledWith(
        {
          source: 'hubmessage-status',
          type: 'ErrorCallback',
          body: envelope.message,
          traceKey: 'trace-1',
          recordOnlyAttempt: nextAttempt,
        },
        { jobId: `hubmessage-status-retry-prov-1-${nextAttempt}`, delay },
      )
    },
  )

  /**
   * Entregue e Lido da mesma mensagem esperam juntos: o estado no jobId impede que um
   * deduplique o outro (o BullMQ ignora jobId repetido).
   */
  it.each([
    ['READ', 'MessageStatusCallback', 'read', 1, 10_000],
    ['READ', 'MessageStatusCallback', 'read', 2, 60_000],
    ['RECEIVED', 'DeliveryCallback', 'delivered', 1, 10_000],
  ] as const)(
    '%s (%s): jobId com %s, tentativa %i espera %i ms',
    async (name, type, kind, nextAttempt, delay) => {
      const progress: HubMessageStatusEnvelope = {
        message: {
          ...envelope.message,
          contents: [{ type, moment: 1795600000, state: { name } }],
        },
      }

      await processHubMessageDeliveryStatus(progress, {
        appendJobLog: async () => {},
        traceKey: 'trace-1',
      })

      await retryRecording()(progress, nextAttempt)

      expect(m.enqueue).toHaveBeenCalledWith(
        {
          source: 'hubmessage-status',
          type,
          body: progress.message,
          traceKey: 'trace-1',
          recordOnlyAttempt: nextAttempt,
        },
        {
          jobId: `hubmessage-status-retry-${kind}-prov-1-${nextAttempt}`,
          delay,
        },
      )
    },
  )

  it('monta o registro de Entregue e Lido', async () => {
    await processHubMessageDeliveryStatus(envelope, {
      appendJobLog: async () => {},
      traceKey: 'trace-1',
    })

    expect(recordProgress()).toBeTypeOf('function')
  })

  it('repassa a tentativa em curso ao caso de uso', async () => {
    const appendJobLog = async () => {}

    await processHubMessageDeliveryStatus(envelope, {
      appendJobLog,
      traceKey: 'trace-1',
      recordOnlyAttempt: 3,
    })

    expect(m.execute).toHaveBeenCalledWith(envelope, {
      appendJobLog,
      recordOnlyAttempt: 3,
    })
  })
})
