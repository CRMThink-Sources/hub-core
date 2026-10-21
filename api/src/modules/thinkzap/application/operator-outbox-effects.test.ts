import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiLogger } = vi.hoisted(() => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('@/shared/infra/logger', () => ({ apiLogger }))

import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import {
  deliverOperatorReply,
  notifyOperatorOutcome,
  notifyOperatorWaiting,
} from './operator-outbox-effects'

const T0 = Date.parse('2026-10-21T13:00:00.000Z')
const PAUSE_UNTIL = T0 + 340_000

const operatorRow = (over: Partial<WidgetOutboxRecord> = {}) =>
  ({
    id: 'ob-1',
    instanceId: 'inst-db-1',
    origin: 'OPERATOR',
    kind: 'TEXT',
    text: 'Olá',
    caption: null,
    mediaType: null,
    fileName: null,
    bitrixChatId: '100',
    domainId: 'domain-1',
    appCode: 'app',
    originContext: {
      kind: 'operator',
      line: '10',
      im: { chat_id: '100', message_id: 'BX-1' },
      connectorChatId: '5511999999999',
      bitrixUserId: '27',
    },
    ...over,
  }) as WidgetOutboxRecord

describe('deliverOperatorReply', () => {
  it('persiste com o id do Bitrix e confirma a entrega no canal aberto', async () => {
    const deps = {
      persist: vi.fn(async () => {}),
      setDelivered: vi.fn(async () => {}),
    }

    const handled = await deliverOperatorReply(operatorRow(), 'Z-1', deps)

    expect(handled).toBe(true)
    expect(deps.persist).toHaveBeenCalledWith({
      instanceId: 'inst-db-1',
      providerMessageId: 'Z-1',
      bitrixMessageId: 'BX-1',
      bitrixChatId: '100',
      chatId: '5511999999999',
      bitrixUserId: '27',
      type: 'TEXT',
      text: 'Olá',
      fileName: null,
    })
    expect(deps.setDelivered).toHaveBeenCalledWith(
      expect.objectContaining({ line: '10' }),
      'Z-1',
    )
  })

  it('documento grava o tipo e o nome do arquivo', async () => {
    const deps = {
      persist: vi.fn(async () => {}),
      setDelivered: vi.fn(async () => {}),
    }

    await deliverOperatorReply(
      operatorRow({
        kind: 'MEDIA',
        mediaType: 'document',
        fileName: 'a.pdf',
        caption: 'legenda',
      }),
      'Z-2',
      deps,
    )

    expect(deps.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DOCUMENT',
        fileName: 'a.pdf',
        text: 'legenda',
      }),
    )
  })

  it('falha ao persistir não impede a confirmação de entrega', async () => {
    const deps = {
      persist: vi.fn().mockRejectedValue(new Error('db')),
      setDelivered: vi.fn(async () => {}),
    }

    await deliverOperatorReply(operatorRow(), 'Z-1', deps)

    expect(deps.setDelivered).toHaveBeenCalled()
  })

  it('row que não é do operador segue os efeitos do widget', async () => {
    const deps = { persist: vi.fn(), setDelivered: vi.fn() }

    expect(
      await deliverOperatorReply(
        operatorRow({ origin: 'WIDGET' }),
        'Z-1',
        deps,
      ),
    ).toBe(false)
    expect(deps.persist).not.toHaveBeenCalled()
  })
})

describe('notifyOperatorOutcome', () => {
  it('Operador responde com o limite atingido: aviso de limite no chat', async () => {
    const notifyDailyLimit = vi.fn(async () => {})

    await notifyOperatorOutcome('daily-limit', operatorRow(), {
      notifyDailyLimit,
    })

    expect(notifyDailyLimit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ob-1' }),
    )
  })

  it('outras falhas ficam só no log', async () => {
    const notifyDailyLimit = vi.fn(async () => {})

    await notifyOperatorOutcome('failed', operatorRow(), { notifyDailyLimit })

    expect(notifyDailyLimit).not.toHaveBeenCalled()
  })
})

describe('notifyOperatorWaiting', () => {
  beforeEach(() => vi.clearAllMocks())

  function deps(posted = true) {
    const claimed = new Set<string>()
    return {
      claimOnce: vi.fn((key: string) => {
        if (claimed.has(key)) return Promise.resolve(false)
        claimed.add(key)
        return Promise.resolve(true)
      }),
      postNotice: vi.fn(() => Promise.resolve(posted)),
      notifyDailyLimit: vi.fn(),
      locale: vi.fn(() => Promise.resolve('pt' as const)),
      now: () => T0,
    }
  }

  const pause = {
    retryAt: PAUSE_UNTIL,
    reason: 'paused' as const,
    waitKey: `paused:${PAUSE_UNTIL}`,
  }

  it('Operador responde durante a pausa: aviso com a saída prevista', async () => {
    const d = deps()

    await notifyOperatorWaiting(operatorRow(), pause, 'Z-1', d)

    expect(d.postNotice).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ob-1' }),
      expect.stringContaining('10:05'),
    )
    expect(d.claimOnce).toHaveBeenCalledWith(
      `thinkzap:cadence-notice:Z-1:100:paused:${PAUSE_UNTIL}`,
      340_000 + 60 * 60 * 1000,
    )
  })

  it('Várias respostas na mesma pausa: um aviso só', async () => {
    const d = deps()

    for (let i = 0; i < 3; i++) {
      await notifyOperatorWaiting(
        operatorRow({ id: `ob-${i}` }),
        pause,
        'Z-1',
        d,
      )
    }

    expect(d.postNotice).toHaveBeenCalledTimes(1)
  })

  it('outra pausa gera outro aviso', async () => {
    const d = deps()

    await notifyOperatorWaiting(operatorRow(), pause, 'Z-1', d)
    await notifyOperatorWaiting(
      operatorRow(),
      {
        ...pause,
        retryAt: PAUSE_UNTIL + 1,
        waitKey: `paused:${PAUSE_UNTIL + 1}`,
      },
      'Z-1',
      d,
    )

    expect(d.postNotice).toHaveBeenCalledTimes(2)
  })

  it('falha ao postar só registra cadence_notify_failed', async () => {
    const d = deps(false)

    await expect(
      notifyOperatorWaiting(operatorRow(), pause, 'Z-1', d),
    ).resolves.toBeUndefined()

    expect(
      [...apiLogger.warn.mock.calls, ...apiLogger.error.mock.calls].some(
        ([fields]) =>
          (fields as { errorCode?: string }).errorCode ===
          'thinkzap.line.cadence_notify_failed',
      ),
    ).toBe(true)
  })

  it('row que não é do operador não avisa', async () => {
    const d = deps()

    await notifyOperatorWaiting(
      operatorRow({ origin: 'WIDGET' }),
      pause,
      'Z-1',
      d,
    )

    expect(d.claimOnce).not.toHaveBeenCalled()
  })
})
