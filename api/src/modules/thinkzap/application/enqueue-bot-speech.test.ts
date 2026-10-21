import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { QueuedBotSessionAdapter } from '@/modules/thinkzap/infra/adapters/queued-bot-session.adapter'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { deliverBotSpeech } from './bot-outbox-effects'
import { EnqueueBotSpeech } from './enqueue-bot-speech'

const item: SubscriptionItem = {
  id: 'i1',
  name: 'L',
  subscription: 's',
  status: 'active',
  settings: DEFAULT_CONNECTOR_SETTINGS,
  vinculatedChannel: null,
  metadata: { provider: 'ZAPI', zApiInstanceId: 'Z-1', zApiInstanceToken: 't' },
}

describe('EnqueueBotSpeech', () => {
  it('a fala vira uma row BOT com o chat do conector como destino', async () => {
    const outbox = {
      createParts: vi.fn((inputs: object[]) =>
        Promise.resolve(
          inputs.map((input, i) => ({
            ...input,
            id: `r-${i}`,
            queueSeq: null,
          })),
        ),
      ),
      setQueueSeq: vi.fn(),
    }
    const sendQueue = { enqueue: vi.fn(async () => {}) }
    const sut = new EnqueueBotSpeech({
      outbox: outbox as never,
      sendQueue,
      cadence: null,
    })

    await sut.execute({
      item,
      instanceDbId: 'inst-db-1',
      domainId: 'd',
      appCode: 'app',
      connectorChatId: '5511999999999',
      bitrixChatId: '1822',
      text: 'Olá! Como posso ajudar?',
      context: { appId: 'app-1', bitrixBotId: 77 },
    })

    expect(outbox.createParts).toHaveBeenCalledWith([
      expect.objectContaining({
        origin: 'BOT',
        kind: 'TEXT',
        destination: '5511999999999',
        bitrixChatId: '1822',
        text: 'Olá! Como posso ajudar?',
        originContext: { kind: 'bot', appId: 'app-1', bitrixBotId: 77 },
      }),
    ])
    expect(sendQueue.enqueue).toHaveBeenCalledWith({ outboxId: 'r-0' })
  })
})

describe('QueuedBotSessionAdapter', () => {
  it('say enfileira e não chama o provider nem o eco', async () => {
    const eco = {
      say: vi.fn(),
      whisper: vi.fn(),
      handoff: vi.fn(),
      finish: vi.fn(),
    }
    const enqueue = vi.fn(async () => {})
    const sut = new QueuedBotSessionAdapter(eco, enqueue)

    await sut.say('1822', 'oi')
    await sut.handoff('1822', { type: 'queue' })

    expect(enqueue).toHaveBeenCalledWith('1822', 'oi')
    expect(eco.say).not.toHaveBeenCalled()
    expect(eco.handoff).toHaveBeenCalledWith('1822', { type: 'queue' })
  })
})

describe('deliverBotSpeech', () => {
  const row = {
    id: 'r',
    origin: 'BOT',
    text: 'oi',
    bitrixChatId: '1822',
    originContext: { kind: 'bot', appId: 'app-1', bitrixBotId: 77 },
  } as unknown as WidgetOutboxRecord

  it('ecoa no chat do canal aberto depois da entrega', async () => {
    const echo = vi.fn(async () => {})

    expect(await deliverBotSpeech(row, { echo })).toBe(true)
    expect(echo).toHaveBeenCalledWith(
      { kind: 'bot', appId: 'app-1', bitrixBotId: 77 },
      '1822',
      'oi',
    )
  })

  it('falha do eco não relança (o contato já recebeu)', async () => {
    const echo = vi.fn().mockRejectedValue(new Error('bitrix'))

    await expect(deliverBotSpeech(row, { echo })).resolves.toBe(true)
  })

  it('row que não é do bot não é tratada', async () => {
    expect(
      await deliverBotSpeech({ ...row, origin: 'WIDGET' }, { echo: vi.fn() }),
    ).toBe(false)
  })
})
