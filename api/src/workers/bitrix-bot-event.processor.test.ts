import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getContextMock,
  resolveSenderMock,
  findLineMock,
  createPartsMock,
  enqueueMock,
  sendMock,
} = vi.hoisted(() => ({
  getContextMock: vi.fn(),
  resolveSenderMock: vi.fn(),
  findLineMock: vi.fn(),
  createPartsMock: vi.fn((inputs: object[]) =>
    Promise.resolve(
      inputs.map((input, i) => ({ ...input, id: `row-${i}`, queueSeq: 1 })),
    ),
  ),
  enqueueMock: vi.fn().mockResolvedValue(undefined),
  sendMock: vi.fn().mockResolvedValue({ messageId: 'Z-1' }),
}))

vi.mock('@/config/env', () => ({
  env: {
    appCodes: { thinkzap: 'thinkzap' },
    bitrix: { botFlowCode: 'thinkzap-flow', connector: { code: 'thinkzap' } },
    zApi: { partnerToken: 'pt', clientToken: 'ct' },
    hubMessage: { baseUrl: 'https://api.hubmessage.io', secretKey: 'sk' },
    // Sem as SPAs de billing a árvore de repositórios não monta no import.
    payments: {
      spa: {
        aplicationEntityType: 1060,
        productEntityType: 1134,
        planEntityType: 1138,
        subscriptionEntityType: 1142,
        subscriptionItemEntityType: 1146,
      },
    },
    crmthinkWebhookUrl: 'https://crmthink.test/rest/1/token/',
    logLevel: 'silent',
    nodeEnv: 'test',
    thinkzapUnifiedOutboxDomains: '',
  },
}))
vi.mock('@/shared/app-catalog/app-catalog', () => ({
  resolveByMarketplaceCode: () => ({ appCodeId: 'app-code' }),
  thinkzapAppCodeId: () => 'app-code',
}))
vi.mock('@/queue/redis-connection', () => ({ redisConnection: {} }))
vi.mock(
  '@/modules/thinkzap/main/make-bitrix-webhook-context-repository',
  () => ({
    makeBitrixWebhookContextRepository: () => ({ getContext: getContextMock }),
  }),
)
vi.mock('@/modules/thinkzap/main/make-outbound-sender-resolver', () => ({
  makeOutboundSenderResolver: () => ({ resolve: resolveSenderMock }),
}))
vi.mock(
  '@/modules/thinkzap/application/helpers/resolve-settings-by-instance-id',
  () => ({ findLineItemByInstanceId: findLineMock }),
)
vi.mock('@/modules/application/main/make-get-aplication-context', () => ({
  makeGetAplicationContext: () => ({}),
}))
vi.mock('@/modules/thinkzap/main/make-daily-send-quota', () => ({
  makeDailySendQuota: () => ({
    reserve: vi.fn().mockResolvedValue({
      status: 'reserved',
      reservation: { release: vi.fn() },
    }),
  }),
}))
vi.mock('@/modules/thinkzap/main/make-send-cadence', () => ({
  makeSendCadence: () => null,
}))
vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository',
  () => ({
    PrismaWidgetOutboxRepository: class {
      createParts = createPartsMock
      setQueueSeq = vi.fn()
    },
  }),
)
vi.mock(
  '@/modules/thinkzap/infra/queue/bullmq-open-channel-conversation.queue',
  () => ({
    BullMqWidgetSendQueue: class {
      enqueue = enqueueMock
    },
  }),
)
vi.mock('@/shared/infra/logger', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
  return { apiLogger: logger, createWorkerSourceLogger: () => logger }
})

import { env } from '@/config/env'
import { comEntregaAoContato } from './bitrix-bot-event.processor'

const context = {
  id: 'domain-1',
  connector: { provider: 'ZAPI' },
  instance: {
    id: 'inst-db-1',
    instanceId: 'Z-1',
    zApiToken: 'tk',
    channelId: null,
  },
}

const line = {
  item: {
    id: 'i1',
    metadata: {
      provider: 'ZAPI',
      zApiInstanceId: 'Z-1',
      zApiInstanceToken: 'tk',
    },
  },
  settings: {},
  entitlement: 'active',
}

const eco = {
  say: vi.fn().mockResolvedValue(undefined),
  whisper: vi.fn(),
  handoff: vi.fn(),
  finish: vi.fn(),
}

const input = (connectorChatId: string | null = '5511999999999') => ({
  domain: 'acme.bitrix24.com.br',
  domainId: 'domain-1',
  memberId: 'm-1',
  lineId: '10',
  chatId: '1822',
  connectorChatId,
  appId: 'app-1',
  bitrixBotId: 77,
  appendJobLog: vi.fn().mockResolvedValue(undefined),
})

const setFlag = (value: string) => {
  ;(
    env as { thinkzapUnifiedOutboxDomains: string }
  ).thinkzapUnifiedOutboxDomains = value
}

describe('comEntregaAoContato', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getContextMock.mockResolvedValue(context)
    findLineMock.mockResolvedValue(line)
    resolveSenderMock.mockReturnValue({ supportsReply: false, send: sendMock })
  })
  afterEach(() => setFlag(''))

  it('sem a flag: entrega direto ao chat do conector, e não ao chat do Bitrix', async () => {
    const sessao = await comEntregaAoContato(eco, input())

    await sessao.say('1822', 'Olá!')

    expect(resolveSenderMock).toHaveBeenCalledWith(
      'ZAPI',
      expect.objectContaining({ chatId: '5511999999999' }),
    )
    expect(sendMock).toHaveBeenCalledWith(
      { kind: 'text', text: 'Olá!' },
      undefined,
    )
    expect(eco.say).toHaveBeenCalledWith('1822', 'Olá!')
    expect(createPartsMock).not.toHaveBeenCalled()
  })

  it('com a flag: a fala vai para a fila e o eco espera a entrega', async () => {
    setFlag('*')
    const sessao = await comEntregaAoContato(eco, input())

    await sessao.say('1822', 'Olá!')

    expect(sendMock).not.toHaveBeenCalled()
    expect(eco.say).not.toHaveBeenCalled()
    expect(createPartsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        origin: 'BOT',
        destination: '5511999999999',
        bitrixChatId: '1822',
        text: 'Olá!',
      }),
    ])
    expect(enqueueMock).toHaveBeenCalledWith({ outboxId: 'row-0' })
  })

  it('diálogo sem chat do conector: a fala fica só no eco', async () => {
    const sessao = await comEntregaAoContato(eco, input(null))

    expect(sessao).toBe(eco)
    expect(resolveSenderMock).not.toHaveBeenCalled()
  })
})
