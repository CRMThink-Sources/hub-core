import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: {
    logLevel: 'silent',
    nodeEnv: 'test',
    bitrix: { connector: { code: 'thinkzap' } },
  },
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import {
  RELEASE_SCRIPT as QUOTA_RELEASE,
  RESERVE_SCRIPT as QUOTA_RESERVE,
  RedisDailySendQuota,
} from '@/modules/thinkzap/infra/queue/redis-daily-send-quota'
import {
  RedisSendCadence,
  cadenceQueueKey,
  cadenceStateKey,
} from '@/modules/thinkzap/infra/queue/redis-send-cadence'
import { fakeCadenceRedis } from '@/modules/thinkzap/infra/queue/redis-send-cadence.fake'
import {
  DispatchWidgetOutboxMessage,
  MEDIA_EXPIRED_FAILURE,
} from './dispatch-widget-outbox-message'
import { settleWidgetAttachmentGroup } from './settle-widget-attachment-group'
import { settleRobotMessageGroup } from './settle-robot-message-group'
import { OutboundMediaNotFoundError } from '@/modules/thinkzap/domain/ports/outbound-media-storage.port'

const MIN = 60_000
const T0 = Date.parse('2026-10-21T13:00:00.000Z')
const LINE_KEY = 'Z-1'

const baseRow = (
  id: string,
  overrides: Partial<WidgetOutboxRecord> = {},
): WidgetOutboxRecord => ({
  id,
  clientMessageId: `client-${id}`,
  instanceId: 'inst-db-1',
  subscriptionItemId: 'item-1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  destination: `55119999${id.padStart(5, '0')}`,
  text: `msg ${id}`,
  entity: 'deal',
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
  operatorBitrixUserId: null,
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
  queueSeq: null,
  cadenceWaitUntil: null,
  reprocessCount: 0,
  lastReprocessedAt: null,
  lastReprocessedBy: null,
  updatedAt: new Date(0),
  createdAt: new Date(T0),
  sentAt: null,
  ...overrides,
})

/** Outbox em memória com as transições que o dispatcher usa. */
function memoryOutbox() {
  const rows = new Map<string, WidgetOutboxRecord>()
  const update = (id: string, patch: Partial<WidgetOutboxRecord>) => {
    const r = rows.get(id)
    if (r) rows.set(id, { ...r, ...patch })
  }
  const outbox = {
    rows,
    findById: vi.fn((id: string) => Promise.resolve(rows.get(id) ?? null)),
    claimForSending: vi.fn((id: string) => {
      const r = rows.get(id)
      if (!r || r.status !== 'PENDING') return Promise.resolve(false)
      update(id, { status: 'SENDING', attempts: r.attempts + 1 })
      return Promise.resolve(true)
    }),
    markSent: vi.fn((id: string, providerMessageId: string) =>
      Promise.resolve(update(id, { status: 'SENT', providerMessageId })),
    ),
    markFailed: vi.fn((id: string, lastError: string) =>
      Promise.resolve(update(id, { status: 'FAILED', lastError })),
    ),
    markUnknown: vi.fn((id: string) =>
      Promise.resolve(update(id, { status: 'UNKNOWN' })),
    ),
    releaseToPending: vi.fn((id: string) =>
      Promise.resolve(update(id, { status: 'PENDING' })),
    ),
    markTimelineNotified: vi.fn(async () => {}),
    markWaiting: vi.fn((id: string, at: Date) =>
      Promise.resolve(update(id, { cadenceWaitUntil: at })),
    ),
    setQueueSeq: vi.fn((id: string, queueSeq: number) => {
      const r = rows.get(id)
      if (r && r.queueSeq == null) update(id, { queueSeq })

      return Promise.resolve()
    }),
    groupOutcome: vi.fn((groupId: string) =>
      Promise.resolve(
        [...rows.values()]
          .filter(r => r.dispatchGroupId === groupId)
          .sort((a, b) => (a.partIndex ?? 0) - (b.partIndex ?? 0)),
      ),
    ),
    claimGroupTimelineNotification: vi.fn((groupId: string) => {
      const first = [...rows.values()].find(
        r => r.dispatchGroupId === groupId && r.partIndex === 0,
      )
      if (!first || first.timelineNotifiedAt) return Promise.resolve(false)
      update(first.id, { timelineNotifiedAt: new Date() })
      return Promise.resolve(true)
    }),
  }
  return outbox
}

function memoryQuota() {
  const store = new Map<string, number>()
  const redis = {
    eval: (script: string, _n: number, ...args: string[]) => {
      if (script === QUOTA_RESERVE) {
        const [sentKey, extraKey, enabled, limit] = args
        const sent = store.get(sentKey!) ?? 0
        const extra = store.get(extraKey!) ?? 0
        if (enabled === '1' && sent >= Number(limit) + extra) {
          return Promise.resolve([0, sent, extra])
        }
        store.set(sentKey!, sent + 1)
        return Promise.resolve([1, sent + 1, extra])
      }
      if (script === QUOTA_RELEASE) {
        const [sentKey] = args as [string]
        store.set(sentKey, Math.max(0, (store.get(sentKey) ?? 0) - 1))
        return Promise.resolve(0)
      }
      throw new Error('script inesperado')
    },
    mget: (...keys: string[]) =>
      Promise.resolve(keys.map(key => String(store.get(key) ?? 0))),
  }
  return new RedisDailySendQuota(redis as never)
}

const settings = (over: Partial<typeof DEFAULT_CONNECTOR_SETTINGS> = {}) => ({
  ...DEFAULT_CONNECTOR_SETTINGS,
  cadenceEnabled: true,
  cadenceMaxMessages: 20,
  cadenceWindowMinutes: 1,
  ...over,
})

function makeSut(
  opts: {
    settings?: object
    provider?: ConnectorProvider
    deps?: Partial<ConstructorParameters<typeof DispatchWidgetOutboxMessage>[0]>
  } = {},
) {
  let clock = T0
  const fake = fakeCadenceRedis()
  const cadence = new RedisSendCadence(fake.redis, () => 0)
  const outbox = memoryOutbox()
  const send = vi.fn(() =>
    Promise.resolve({
      messageId: `p-${send.mock.calls.length}`,
      persistedType: 'TEXT',
    }),
  )
  const onCadenceDeferred = vi.fn(async () => {})
  const notifyOutcome = vi.fn(async () => {})

  const sut = new DispatchWidgetOutboxMessage({
    outbox: outbox as never,
    senderResolver: { resolve: () => ({ send }) } as never,
    templateSenderResolver: { resolve: vi.fn() } as never,
    interactiveButtonSenderResolver: { resolve: vi.fn() } as never,
    messages: { create: vi.fn(async () => {}) } as never,
    openChannelQueue: { enqueue: vi.fn(async () => {}) },
    acquireLock: vi.fn(() => Promise.resolve({ release: async () => {} })),
    notifyOutcome,
    notifySent: vi.fn(async () => {}),
    quota: memoryQuota(),
    cadence,
    onCadenceDeferred,
    now: () => new Date(clock),
    ...opts.deps,
  })

  const line = {
    provider: opts.provider ?? ConnectorProvider.ZAPI,
    instanceId: LINE_KEY,
    zApiToken: 'tk',
    settings: (opts.settings ?? settings()) as never,
  }

  /** Grava a row e dá a vez na fila, como o enfileiramento faz. */
  const add = async (
    id: string,
    overrides: Partial<WidgetOutboxRecord> = {},
  ) => {
    outbox.rows.set(id, baseRow(id, overrides))
    const seq = await cadence.enqueue(LINE_KEY, id)
    await outbox.setQueueSeq(id, seq)
  }

  return {
    sut,
    outbox,
    send,
    cadence,
    fake,
    onCadenceDeferred,
    notifyOutcome,
    add,
    line,
    setClock: (ms: number) => {
      clock = T0 + ms
    },
    dispatch: (id: string, isLastAttempt = false) =>
      sut.execute({ outboxId: id, line, isLastAttempt }),
  }
}

describe('DispatchWidgetOutboxMessage — cadência', () => {
  beforeEach(() => vi.clearAllMocks())

  it('negada a vaga: não reivindica, não soma attempts e marca a espera', async () => {
    const s = makeSut({ settings: settings({ cadenceMaxMessages: 1 }) })
    await s.add('1')
    await s.add('2')
    await s.dispatch('1')

    const outcome = await s.dispatch('2')

    expect(outcome).toEqual({
      status: 'deferred',
      retryAt: T0 + MIN,
      reason: 'window-full',
    })
    expect(s.outbox.rows.get('2')).toMatchObject({
      status: 'PENDING',
      attempts: 0,
      cadenceWaitUntil: new Date(T0 + MIN),
    })
    expect(s.outbox.claimForSending).toHaveBeenCalledTimes(1)
    expect(s.onCadenceDeferred).toHaveBeenCalledWith(
      expect.objectContaining({ id: '2' }),
      {
        retryAt: T0 + MIN,
        reason: 'window-full',
        waitKey: `window-full:${T0 + MIN}`,
      },
    )
  })

  it('concedida a vaga, envia', async () => {
    const s = makeSut()
    await s.add('1')

    expect(await s.dispatch('1')).toMatchObject({ status: 'sent' })
    expect(s.send).toHaveBeenCalledTimes(1)
  })

  it('linha oficial não consulta a cadência', async () => {
    const s = makeSut({ provider: ConnectorProvider.HUBMESSAGE })
    s.outbox.rows.set('1', baseRow('1'))
    const reserve = vi.spyOn(s.cadence, 'reserve')

    expect((await s.dispatch('1')).status).toBe('sent')
    expect(reserve).not.toHaveBeenCalled()
  })

  it('fora da vez: adia sem marcar espera nem avisar', async () => {
    const s = makeSut()
    await s.add('1')
    await s.add('2')

    const outcome = await s.dispatch('2')

    expect(outcome).toMatchObject({ status: 'deferred', reason: 'not-head' })
    expect(s.outbox.markWaiting).not.toHaveBeenCalled()
    expect(s.onCadenceDeferred).not.toHaveBeenCalled()
  })

  it('row sem posição (Redis falhou no enfileiramento) entra no fim da fila', async () => {
    const s = makeSut()
    s.outbox.rows.set('1', baseRow('1'))

    expect((await s.dispatch('1')).status).toBe('sent')
    expect(s.outbox.setQueueSeq).toHaveBeenCalledWith('1', 1)
  })

  it('Espera não consome tentativas: três adiamentos e ainda retenta no erro do provider', async () => {
    const s = makeSut({
      settings: settings({
        cadenceMaxMessages: 1,
        cadencePauseEnabled: true,
        cadencePauseMinutes: 5,
      }),
    })
    await s.add('0')
    await s.dispatch('0') // abre e pausa
    await s.add('1')

    for (let i = 1; i <= 3; i++) {
      s.setClock(i * 1_000)
      expect((await s.dispatch('1')).status).toBe('deferred')
    }
    expect(s.outbox.rows.get('1')?.attempts).toBe(0)

    s.setClock(5 * MIN)
    s.send.mockRejectedValueOnce(
      new HubMessageApiError(500, 'POST', '/m', { e: 1 }, null),
    )
    // Não é a última tentativa: volta a PENDING e relança para o BullMQ.
    await expect(s.dispatch('1', false)).rejects.toBeInstanceOf(
      HubMessageApiError,
    )
    expect(s.outbox.rows.get('1')).toMatchObject({
      status: 'PENDING',
      attempts: 1,
    })
  })

  it('Erro do provider não conta: a vaga volta', async () => {
    const s = makeSut()
    await s.add('1')
    s.send.mockRejectedValueOnce(
      new HubMessageApiError(500, 'POST', '/m', { e: 1 }, null),
    )

    await s.dispatch('1', true)

    expect((await s.cadence.state(LINE_KEY, new Date(T0))).count).toBe(0)
  })

  it('falha indeterminada mantém a vaga', async () => {
    const s = makeSut()
    await s.add('1')
    s.send.mockRejectedValueOnce(
      new HubMessageApiError(undefined, 'POST', '/m', null, null),
    )

    expect((await s.dispatch('1')).status).toBe('unknown')
    expect((await s.cadence.state(LINE_KEY, new Date(T0))).count).toBe(1)
  })

  it('Limite diário atingido durante a espera: falha com daily_limit_reached e devolve a vaga', async () => {
    const s = makeSut({
      settings: settings({ dailyLimitEnabled: true, dailyLimit: 1 }),
    })
    await s.add('1')
    await s.add('2')
    await s.dispatch('1') // consome a última vaga do dia

    const outcome = await s.dispatch('2')

    expect(outcome).toEqual({ status: 'failed' })
    expect(s.outbox.rows.get('2')?.status).toBe('FAILED')
    expect(s.notifyOutcome).toHaveBeenCalledWith(
      'daily-limit',
      expect.objectContaining({ id: '2' }),
    )
    expect((await s.cadence.state(LINE_KEY, new Date(T0))).count).toBe(1)
  })

  it.each([
    ['SENT', (s: ReturnType<typeof makeSut>) => s.dispatch('1')],
    [
      'FAILED',
      async (s: ReturnType<typeof makeSut>) => {
        s.outbox.rows.set('1', { ...s.outbox.rows.get('1')!, status: 'FAILED' })
        return s.dispatch('1')
      },
    ],
    [
      'UNKNOWN',
      async (s: ReturnType<typeof makeSut>) => {
        s.send.mockRejectedValueOnce(
          new HubMessageApiError(undefined, 'POST', '/m', null, null),
        )
        return s.dispatch('1')
      },
    ],
    [
      'skipped (row sumida)',
      async (s: ReturnType<typeof makeSut>) => {
        s.outbox.rows.delete('1')
        return s.dispatch('1')
      },
    ],
  ])('o ticket sai da fila em %s', async (_label, run) => {
    const s = makeSut()
    await s.add('1')

    await run(s)

    expect(s.fake.ordered(cadenceQueueKey(LINE_KEY))).toEqual([])
  })

  it('deferred mantém o ticket na fila', async () => {
    const s = makeSut({ settings: settings({ cadenceMaxMessages: 1 }) })
    await s.add('1')
    await s.add('2')
    await s.dispatch('1')

    await s.dispatch('2')

    expect(s.fake.ordered(cadenceQueueKey(LINE_KEY))).toEqual(['2'])
  })
})

describe('DispatchWidgetOutboxMessage — Ritmo sem pausa (integração)', () => {
  it('50 mensagens, N = 20, D = 1: 20 por janela, sem recusa, na ordem de queueSeq', async () => {
    const s = makeSut()
    const ids = Array.from({ length: 50 }, (_, i) => String(i + 1))
    for (const id of ids) await s.add(id)

    /**
     * Simula o BullMQ: cada job pendente tenta; o adiado volta em `retryAt`. Os jobs
     * acordam em ordem embaralhada (concorrência), e a ordem de envio ainda é a de
     * `queueSeq`.
     */
    const due = new Map(ids.map(id => [id, T0]))
    const sentAt: { id: string; at: number }[] = []
    let guard = 0
    while (due.size > 0 && guard++ < 10_000) {
      const next = Math.min(...due.values())
      s.setClock(next - T0)
      const ready = [...due.entries()]
        .filter(([, at]) => at <= next)
        .map(([id]) => id)
        .reverse() // ordem de processamento diferente da de chegada
      for (const id of ready) {
        const outcome = await s.dispatch(id)
        if (outcome.status === 'deferred') {
          due.set(id, outcome.retryAt)
        } else {
          expect(outcome.status).toBe('sent')
          sentAt.push({ id, at: next })
          due.delete(id)
        }
      }
    }

    expect(sentAt.map(e => e.id)).toEqual(ids)
    const windowOf = (at: number) => Math.floor((at - T0) / MIN)
    const perWindow = sentAt.reduce<Record<number, number>>((acc, e) => {
      acc[windowOf(e.at)] = (acc[windowOf(e.at)] ?? 0) + 1
      return acc
    }, {})
    expect(perWindow).toEqual({ 0: 20, 1: 20, 2: 10 })
    expect(
      s.fake.hashes.get(cadenceStateKey(LINE_KEY))?.count,
    ).toBeLessThanOrEqual(20)
  })
})

describe('DispatchWidgetOutboxMessage — envio com anexo em grupo', () => {
  beforeEach(() => vi.clearAllMocks())

  function groupSut(
    settingsOver: Partial<typeof DEFAULT_CONNECTOR_SETTINGS> = {},
  ) {
    const postTimeline = vi.fn(async () => {})
    const notifyGroupOutcome = vi.fn(async () => {})
    const openChannelQueue = { enqueue: vi.fn(async () => {}) }
    const releaseMedia = vi.fn(async () => {})
    const resolveMedia = vi.fn((r: WidgetOutboxRecord) =>
      Promise.resolve({
        url: `data:x;base64,${r.id}`,
      }),
    )
    const s = makeSut({
      settings: settings(settingsOver),
      deps: {
        resolveMedia,
        releaseMedia,
        onGroupSettled: settled =>
          settleWidgetAttachmentGroup(settled, {
            openChannelQueue,
            postTimeline,
            notifyOutcome: notifyGroupOutcome,
            fromPhone: () => Promise.resolve('5511911111111'),
            locale: () => Promise.resolve('pt' as const),
          }),
      },
    })
    const addGroup = async () => {
      const common = {
        dispatchGroupId: 'g-1',
        origin: 'WIDGET_ATTACHMENT' as const,
      }
      await s.add('t', {
        ...common,
        partIndex: 0,
        text: 'Segue',
        dispatchMeta: {
          kind: 'widget-attachment',
          message: 'Segue',
          attachmentKinds: ['file', 'image'],
        },
      })
      await s.add('a1', {
        ...common,
        partIndex: 1,
        kind: 'MEDIA',
        text: '',
        mediaType: 'document',
        fileName: 'contrato.pdf',
        mediaSource: { kind: 'stored', key: 'k1' },
      })
      await s.add('a2', {
        ...common,
        partIndex: 2,
        kind: 'MEDIA',
        text: '',
        mediaType: 'image',
        mediaSource: { kind: 'stored', key: 'k2' },
      })
    }
    return {
      ...s,
      addGroup,
      postTimeline,
      notifyGroupOutcome,
      openChannelQueue,
      releaseMedia,
      resolveMedia,
    }
  }

  it('Texto com anexos conta cada parte: a janela soma 3, um comentário e uma conversa', async () => {
    const s = groupSut()
    await s.addGroup()

    for (const id of ['t', 'a1', 'a2']) {
      expect((await s.dispatch(id)).status).toBe('sent')
    }

    expect((await s.cadence.state(LINE_KEY, new Date(T0))).count).toBe(3)
    expect(s.send).toHaveBeenNthCalledWith(2, {
      kind: 'document',
      url: 'data:x;base64,a1',
      fileName: 'contrato.pdf',
    })
    expect(s.postTimeline).toHaveBeenCalledTimes(1)
    expect(s.openChannelQueue.enqueue).toHaveBeenCalledTimes(1)
    expect(s.openChannelQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ providerMessageId: 'p-1' }),
    )
    // Parte de grupo não avisa sozinha.
    expect(s.notifyOutcome).not.toHaveBeenCalled()
    expect(s.releaseMedia).toHaveBeenCalledTimes(2)
  })

  it('Limite acaba no meio do envio com anexos: o texto sai, os 2 anexos não, e o comentário diz 2', async () => {
    const s = groupSut({ dailyLimitEnabled: true, dailyLimit: 1 })
    await s.addGroup()

    await s.dispatch('t')
    await s.dispatch('a1')
    await s.dispatch('a2')

    expect(s.send).toHaveBeenCalledTimes(1)
    expect(s.outbox.rows.get('a1')?.status).toBe('FAILED')
    expect(s.postTimeline).toHaveBeenCalledTimes(1)
    const [, message] = s.postTimeline.mock.calls[0] as unknown as [
      unknown,
      string,
    ]
    expect(message).toContain('Mensagem: Segue')
    expect(message).toContain('2')
    expect(s.notifyGroupOutcome).not.toHaveBeenCalled()
  })

  it('nada saiu: o aviso de não entregue sai uma vez, pela row do grupo', async () => {
    const s = groupSut({ dailyLimitEnabled: true, dailyLimit: 1 })
    await s.add('x', {}) // consome a vaga do dia
    await s.dispatch('x')
    await s.addGroup()

    for (const id of ['t', 'a1', 'a2']) await s.dispatch(id)

    expect(s.postTimeline).not.toHaveBeenCalled()
    expect(s.notifyGroupOutcome).toHaveBeenCalledTimes(1)
    expect(s.notifyGroupOutcome).toHaveBeenCalledWith(
      'daily-limit',
      expect.objectContaining({ id: 't' }),
    )
  })

  it('arquivo expirado: a parte falha sem chamar o provider e sem gastar vaga', async () => {
    const s = groupSut()
    await s.addGroup()
    s.resolveMedia.mockRejectedValueOnce(new OutboundMediaNotFoundError('k1'))

    await s.dispatch('t')
    expect((await s.dispatch('a1')).status).toBe('failed')

    expect(s.outbox.rows.get('a1')).toMatchObject({
      status: 'FAILED',
      lastError: MEDIA_EXPIRED_FAILURE,
    })
    expect(s.send).toHaveBeenCalledTimes(1)
    expect((await s.cadence.state(LINE_KEY, new Date(T0))).count).toBe(1)
  })
})

describe('DispatchWidgetOutboxMessage — robô "Enviar mensagem" em grupo', () => {
  beforeEach(() => vi.clearAllMocks())

  function robotSut(
    settingsOver: Partial<typeof DEFAULT_CONNECTOR_SETTINGS> = {},
  ) {
    const postTimeline = vi.fn(async () => {})
    const s = makeSut({
      settings: settings(settingsOver),
      deps: {
        resolveMedia: r => Promise.resolve({ url: `data:x;base64,${r.id}` }),
        releaseMedia: vi.fn(async () => {}),
        onGroupSettled: settled =>
          settleRobotMessageGroup(settled, {
            postTimeline,
            locale: () => Promise.resolve('pt' as const),
          }),
      },
    })
    const meta = (recipients: string[], requestedFiles = 0) => ({
      kind: 'robot-message',
      fromPhone: '5511911111111',
      message: 'Olá',
      requestedFiles,
      failedFiles: [],
      recipients,
      crmDocument: { entity: 'DEAL', entityId: '10' },
    })
    return { ...s, postTimeline, meta }
  }

  const common = { dispatchGroupId: 'g-r', origin: 'ROBOT_MESSAGE' as const }

  it('Comentário depois da espera por cadência: sai uma vez, depois da última parte', async () => {
    const s = robotSut({ cadenceMaxMessages: 1 })
    await s.add('p0', {
      ...common,
      partIndex: 0,
      destination: '5511999990000',
      dispatchMeta: s.meta(['5511999990000', '5511999990001']),
    })
    await s.add('p1', { ...common, partIndex: 1, destination: '5511999990001' })

    await s.dispatch('p0')
    expect((await s.dispatch('p1')).status).toBe('deferred')
    expect(s.postTimeline).not.toHaveBeenCalled()

    s.setClock(MIN)
    await s.dispatch('p1')

    expect(s.postTimeline).toHaveBeenCalledTimes(1)
    const [document, message] = s.postTimeline.mock.calls[0] as unknown as [
      object,
      string,
    ]
    expect(document).toEqual({ entity: 'DEAL', entityId: '10' })
    expect(message).toContain('5511999990000')
    expect(message).toContain('5511999990001')
  })

  it('Robô além do limite: só o primeiro recebe e o segundo aparece como não enviado', async () => {
    const s = robotSut({ dailyLimitEnabled: true, dailyLimit: 1 })
    await s.add('p0', {
      ...common,
      partIndex: 0,
      destination: '5511999990000',
      dispatchMeta: s.meta(['5511999990000', '5511999990001']),
    })
    await s.add('p1', { ...common, partIndex: 1, destination: '5511999990001' })

    await s.dispatch('p0')
    await s.dispatch('p1')

    expect(s.send).toHaveBeenCalledTimes(1)
    const [, message] = s.postTimeline.mock.calls[0] as unknown as [
      object,
      string,
    ]
    const [enviados, recusados] = message
      .split('\n')
      .reduce<[string[], string[]]>(
        (acc, line) => {
          acc[line.toLowerCase().includes('limite') ? 1 : 0].push(line)
          return acc
        },
        [[], []],
      )
    expect(enviados.join('\n')).toContain('5511999990000')
    expect(recusados.join('\n')).toContain('5511999990001')
  })

  it('Limite atingido no meio: contrato.pdf sai, anexo.png não, e o destinatário fica como não atendido', async () => {
    const s = robotSut({ dailyLimitEnabled: true, dailyLimit: 1 })
    await s.add('f0', {
      ...common,
      partIndex: 0,
      destination: '5511999990000',
      kind: 'MEDIA',
      text: '',
      mediaType: 'document',
      fileName: 'contrato.pdf',
      mediaSource: { kind: 'stored', key: 'k1' },
      dispatchMeta: s.meta(['5511999990000'], 2),
    })
    await s.add('f1', {
      ...common,
      partIndex: 1,
      destination: '5511999990000',
      kind: 'MEDIA',
      text: '',
      mediaType: 'image',
      fileName: 'anexo.png',
      mediaSource: { kind: 'stored', key: 'k2' },
    })

    await s.dispatch('f0')
    await s.dispatch('f1')

    expect(s.send).toHaveBeenCalledTimes(1)
    const [, message] = s.postTimeline.mock.calls[0] as unknown as [
      object,
      string,
    ]
    expect(message).toContain('contrato.pdf')
    expect(message).toMatch(/limite/i)
    expect(message).toContain('5511999990000')
  })
})

describe('DispatchWidgetOutboxMessage — resposta do operador', () => {
  beforeEach(() => vi.clearAllMocks())

  const op = { origin: 'OPERATOR' as const, bitrixChatId: '100' }

  it('Operador espera a janela: avisa uma espera e envia na janela seguinte, sem erro', async () => {
    const s = makeSut({ settings: settings({ cadenceMaxMessages: 1 }) })
    await s.add('robo')
    await s.add('op', op)
    await s.dispatch('robo')

    expect((await s.dispatch('op')).status).toBe('deferred')
    expect(s.onCadenceDeferred).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'op', origin: 'OPERATOR' }),
      expect.objectContaining({ reason: 'window-full' }),
    )

    s.setClock(MIN)
    expect((await s.dispatch('op')).status).toBe('sent')
    expect(s.notifyOutcome).not.toHaveBeenCalled()
  })

  it('Limite atingido enquanto a resposta do operador espera a cadência: aviso de limite', async () => {
    const s = makeSut({
      settings: settings({
        cadenceMaxMessages: 1,
        dailyLimitEnabled: true,
        dailyLimit: 1,
      }),
    })
    await s.add('robo')
    await s.add('op', op)
    await s.dispatch('robo')
    await s.dispatch('op') // espera a janela

    s.setClock(MIN)
    expect(await s.dispatch('op')).toEqual({ status: 'failed' })

    expect(s.send).toHaveBeenCalledTimes(1)
    expect(s.notifyOutcome).toHaveBeenCalledWith(
      'daily-limit',
      expect.objectContaining({ id: 'op', origin: 'OPERATOR' }),
    )
  })

  it('a citação do evento vai como referência ao provider', async () => {
    const s = makeSut()
    await s.add('op', {
      ...op,
      originContext: { kind: 'operator', referencedMessageId: 'Z-ORIG' },
    })

    await s.dispatch('op')

    expect(s.send).toHaveBeenCalledWith(
      { kind: 'text', text: 'msg op' },
      { referencedMessageId: 'Z-ORIG' },
    )
  })
})

describe('DispatchWidgetOutboxMessage — fala do bot', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Bot espera a janela: durante a pausa fica na fila e sai quando a pausa termina', async () => {
    const onDelivered = vi.fn(() => Promise.resolve(true))
    const s = makeSut({
      settings: settings({
        cadenceMaxMessages: 1,
        cadencePauseEnabled: true,
        cadencePauseMinutes: 5,
      }),
      deps: { onDelivered },
    })
    await s.add('x')
    await s.add('bot', { origin: 'BOT', bitrixChatId: '1822' })
    await s.dispatch('x') // abre e pausa

    expect((await s.dispatch('bot')).status).toBe('deferred')
    expect(onDelivered).toHaveBeenCalledTimes(1) // só o 'x'

    s.setClock(5 * MIN)
    expect((await s.dispatch('bot')).status).toBe('sent')
    expect(onDelivered).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'bot', origin: 'BOT' }),
      expect.any(String),
    )
  })

  it('Ordem por destinatário entre origens: a fala do bot sai antes da resposta do operador', async () => {
    const s = makeSut({
      settings: settings({
        cadenceMaxMessages: 1,
        cadencePauseEnabled: true,
        cadencePauseMinutes: 5,
      }),
    })
    await s.add('x')
    await s.dispatch('x') // pausa
    await s.add('bot', { origin: 'BOT', destination: '5511900000001' })
    await s.add('op', { origin: 'OPERATOR', destination: '5511900000001' })

    s.setClock(5 * MIN)
    // O operador acorda primeiro, mas a vez é da fala do bot.
    expect((await s.dispatch('op')).status).toBe('deferred')
    expect((await s.dispatch('bot')).status).toBe('sent')

    s.setClock(10 * MIN)
    expect((await s.dispatch('op')).status).toBe('sent')
    expect(
      (s.send.mock.calls as unknown as [{ text: string }][]).map(
        ([d]) => d.text,
      ),
    ).toEqual(['msg x', 'msg bot', 'msg op'])
  })
})
