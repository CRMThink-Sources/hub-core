import { describe, expect, it, vi } from 'vitest'
import type {
  PrismaSendNoticeRepository,
  SendNoticeRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-send-notice.repository'
import type {
  PrismaWidgetOutboxRepository,
  WidgetOutboxRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { SendNoticeDeferredError } from '@/modules/thinkzap/domain/errors/send-notice-deferred.error'
import { BitrixMethodPausedError } from '@/shared/infra/bitrix-limits/bitrix-limits.port'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  notifySendFailures,
  SendFailureAlertError,
  type NotifySendFailuresDeps,
} from './notify-send-failures'

const notice = (
  overrides: Partial<SendNoticeRecord> = {},
): SendNoticeRecord => ({
  id: 'notice-1',
  dispatchKey: 'dispatch-1',
  domainId: 'domain-1',
  appCode: 'thinkzap',
  entity: 'deal',
  entityId: '42',
  operatorBitrixUserId: '7',
  eager: false,
  commentId: null,
  commentAsAuthor: false,
  commentClaimedAt: null,
  fromPhone: null,
  alertedFailures: 0,
  createdAt: new Date('2026-11-27T10:00:00Z'),
  updatedAt: new Date('2026-11-27T10:00:00Z'),
  ...overrides,
})

const row = (overrides: Partial<WidgetOutboxRecord> = {}): WidgetOutboxRecord =>
  ({
    destination: '5511888880000',
    status: 'FAILED',
    lastError: 'Número inválido',
    rejectedAt: null,
    failureCode: null,
    failureReason: null,
    ...overrides,
  }) as WidgetOutboxRecord

const threeFailures = [
  row({ destination: '1' }),
  row({ destination: '2' }),
  row({ destination: '3' }),
]

function setup(
  input: {
    notice?: SendNoticeRecord | null
    rows?: WidgetOutboxRecord[]
    assignedById?: unknown
    notifyFails?: boolean
    /** Erro lançado pela chamada de `method`, no lugar da resposta. */
    failing?: { method: string; error: Error }
  } = {},
) {
  const callMethod = vi
    .fn<(method: string, params: Record<string, unknown>) => Promise<unknown>>()
    .mockImplementation(method => {
      if (input.failing?.method === method) {
        return Promise.reject(input.failing.error)
      }
      if (method === 'crm.item.get') {
        return Promise.resolve({
          result: { item: { assignedById: input.assignedById } },
        })
      }
      return input.notifyFails
        ? Promise.reject(new Error('sem escopo im'))
        : Promise.resolve({ result: 1 })
    })
  const notices = {
    findById: vi
      .fn<PrismaSendNoticeRepository['findById']>()
      .mockResolvedValue(input.notice === undefined ? notice() : input.notice),
    saveAlerted: vi
      .fn<PrismaSendNoticeRepository['saveAlerted']>()
      .mockResolvedValue(undefined),
  }
  const outbox = {
    findBySendNotice: vi
      .fn<PrismaWidgetOutboxRepository['findBySendNotice']>()
      .mockResolvedValue(input.rows ?? threeFailures),
  }
  const deps: NotifySendFailuresDeps = {
    notices,
    outbox,
    bitrix: vi.fn<NotifySendFailuresDeps['bitrix']>().mockResolvedValue({
      callMethod: callMethod as BitrixClient['callMethod'],
    }),
    locale: vi.fn<NotifySendFailuresDeps['locale']>().mockResolvedValue('pt'),
    now: () => new Date(NOW),
  }
  const notifications = () =>
    callMethod.mock.calls
      .filter(([method]) => method === 'im.notify.system.add')
      .map(([, params]) => params as { USER_ID: number; MESSAGE: string })
  return { deps, callMethod, notices, notifications }
}

const NOW = Date.parse('2026-11-27T10:05:00Z')

describe('notifySendFailures', () => {
  it('pausa do Bitrix na notificação adia o aviso sem gravá-lo', async () => {
    const until = NOW + 120_000
    const { deps, notices } = setup({
      failing: {
        method: 'im.notify.system.add',
        error: new BitrixMethodPausedError('im.notify.system.add', 'x', until),
      },
    })

    const error: unknown = await notifySendFailures('notice-1', deps).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(SendNoticeDeferredError)
    expect((error as SendNoticeDeferredError).untilMs).toBe(until)
    expect(notices.saveAlerted).not.toHaveBeenCalled()
  })

  it('limite ao buscar o responsável também adia', async () => {
    const { deps } = setup({
      notice: notice({ operatorBitrixUserId: null }),
      failing: {
        method: 'crm.item.get',
        error: new Error(
          'Bitrix error: 503 - {"error":"QUERY_LIMIT_EXCEEDED"}',
        ),
      },
    })

    await expect(notifySendFailures('notice-1', deps)).rejects.toBeInstanceOf(
      SendNoticeDeferredError,
    )
  })

  it('outra falha ao buscar o responsável sobe como está', async () => {
    const { deps } = setup({
      notice: notice({ operatorBitrixUserId: null }),
      failing: { method: 'crm.item.get', error: new Error('socket hang up') },
    })

    await expect(notifySendFailures('notice-1', deps)).rejects.toThrow(
      'socket hang up',
    )
  })

  it('avisa 3 falhas numa chamada só, com a tag do aviso', async () => {
    const { deps, notices, notifications } = setup()

    await notifySendFailures('notice-1', deps)

    expect(notifications()).toHaveLength(1)
    expect(notifications()[0]).toMatchObject({
      USER_ID: 7,
      TAG: 'thinkzap-send-notice-1',
    })
    const message = notifications()[0]!.MESSAGE
    expect(message).toContain('Destinatários com falha no envio: 3')
    expect(message).toContain('Número inválido')
    expect(message).toContain('[URL=/crm/deal/details/42/]')
    expect(notices.saveAlerted).toHaveBeenCalledWith('notice-1', 3)
  })

  it('não repete o aviso quando a contagem não passou da já avisada', async () => {
    const { deps, notices, callMethod } = setup({
      notice: notice({ alertedFailures: 3 }),
    })

    await notifySendFailures('notice-1', deps)

    expect(callMethod).not.toHaveBeenCalled()
    expect(notices.saveAlerted).not.toHaveBeenCalled()
  })

  it('avisa de novo quando surge falha além das já avisadas', async () => {
    const { deps, notices, notifications } = setup({
      notice: notice({ alertedFailures: 2 }),
    })

    await notifySendFailures('notice-1', deps)

    expect(notifications()).toHaveLength(1)
    expect(notices.saveAlerted).toHaveBeenCalledWith('notice-1', 3)
  })

  it('não avisa disparo sem falha', async () => {
    const { deps, callMethod } = setup({
      rows: [row({ status: 'SENT', lastError: null })],
    })

    await notifySendFailures('notice-1', deps)

    expect(callMethod).not.toHaveBeenCalled()
  })

  it('não faz nada quando o aviso não existe', async () => {
    const { deps, callMethod } = setup({ notice: null })

    await notifySendFailures('notice-1', deps)

    expect(callMethod).not.toHaveBeenCalled()
  })

  it('omite o motivo quando as falhas têm motivos diferentes', async () => {
    const { deps, notifications } = setup({
      rows: [
        row({ destination: '1', lastError: 'Número inválido' }),
        row({ destination: '2', lastError: 'Linha desconectada' }),
      ],
    })

    await notifySendFailures('notice-1', deps)

    expect(notifications()[0]!.MESSAGE).not.toContain('Motivo')
  })

  it('mantém o pedido de conferência em quem também falhou', async () => {
    const { deps, notices, notifications } = setup({
      rows: [
        row({ destination: '1', status: 'SENT', lastError: null }),
        row({ destination: '1' }),
        row({ destination: '1', status: 'UNKNOWN', lastError: null }),
        row({ destination: '2', status: 'UNKNOWN', lastError: null }),
      ],
    })

    await notifySendFailures('notice-1', deps)

    const message = notifications()[0]!.MESSAGE
    expect(message).toContain('Destinatários com falha no envio: 1')
    expect(message).toContain('Destinatários sem confirmação de envio: 2')
    expect(message).toContain('ANTES de reenviar')
    // O limite conta destinatários: o que pede os dois cuidados vale um.
    expect(notices.saveAlerted).toHaveBeenCalledWith('notice-1', 2)
  })

  it('sem operador, avisa o responsável pelo registro', async () => {
    const { deps, callMethod, notifications } = setup({
      notice: notice({
        operatorBitrixUserId: null,
        entity: 'DYNAMIC_128',
        entityId: '9',
      }),
      assignedById: 15,
    })

    await notifySendFailures('notice-1', deps)

    expect(callMethod).toHaveBeenCalledWith('crm.item.get', {
      entityTypeId: 128,
      id: '9',
    })
    expect(notifications()[0]).toMatchObject({ USER_ID: 15 })
  })

  it('desiste sem operador nem responsável', async () => {
    const { deps, notices, notifications } = setup({
      notice: notice({ operatorBitrixUserId: null }),
    })

    await notifySendFailures('notice-1', deps)

    expect(notifications()).toHaveLength(0)
    expect(notices.saveAlerted).not.toHaveBeenCalled()
  })

  it('desiste sem operador num registro que não é do CRM', async () => {
    const { deps, callMethod } = setup({
      notice: notice({ operatorBitrixUserId: null, entity: 'task' }),
    })

    await notifySendFailures('notice-1', deps)

    expect(callMethod).not.toHaveBeenCalled()
  })

  it('não grava e lança quando o Bitrix recusa a notificação', async () => {
    const { deps, notices } = setup({ notifyFails: true })

    await expect(notifySendFailures('notice-1', deps)).rejects.toThrow(
      SendFailureAlertError,
    )

    expect(notices.saveAlerted).not.toHaveBeenCalled()
  })

  it('não grava quando não há cliente Bitrix', async () => {
    const { deps, notices } = setup()
    vi.mocked(deps.bitrix).mockResolvedValue(null)

    await notifySendFailures('notice-1', deps)

    expect(notices.saveAlerted).not.toHaveBeenCalled()
  })
})
