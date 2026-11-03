import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { ensureEventBindings } from './ensure-event-bindings'

const HANDLER = 'https://api.test/webhooks/bitrix'

function clientBoundTo(events: Array<{ event: string; handler: string }>) {
  return vi.fn().mockImplementation((method: string): Promise<unknown> => {
    if (method === 'event.get') return Promise.resolve({ result: events })
    return Promise.resolve({})
  })
}

function callsTo(
  callMethod: ReturnType<typeof vi.fn>,
  method: string,
): Array<Record<string, unknown>> {
  return callMethod.mock.calls
    .filter(call => call[0] === method)
    .map(call => call[1] as Record<string, unknown>)
}

describe('ensureEventBindings', () => {
  let callMethod: ReturnType<typeof vi.fn>

  beforeEach(() => {
    callMethod = clientBoundTo([])
  })

  it('vincula evento ainda não ligado', async () => {
    await ensureEventBindings({ callMethod } as never, [
      { event: 'ONIMCONNECTORMESSAGEADD', handler: HANDLER },
    ])

    expect(callsTo(callMethod, 'event.bind')).toEqual([
      {
        event: 'ONIMCONNECTORMESSAGEADD',
        handler: HANDLER,
        auth_type: '0',
        offline: 0,
      },
    ])
  })

  it('não rebinda evento já ligado no mesmo handler', async () => {
    callMethod = clientBoundTo([
      { event: 'ONIMCONNECTORMESSAGEADD', handler: HANDLER },
    ])

    await ensureEventBindings({ callMethod } as never, [
      { event: 'ONIMCONNECTORMESSAGEADD', handler: HANDLER },
    ])

    expect(callsTo(callMethod, 'event.bind')).toEqual([])
    expect(callsTo(callMethod, 'event.unbind')).toEqual([])
  })

  it('ignora caixa do nome do evento vindo do portal', async () => {
    callMethod = clientBoundTo([
      { event: 'onimconnectormessageadd', handler: HANDLER },
    ])

    await ensureEventBindings({ callMethod } as never, [
      { event: 'ONIMCONNECTORMESSAGEADD', handler: HANDLER },
    ])

    expect(callsTo(callMethod, 'event.bind')).toEqual([])
  })

  it('desliga o handler antigo antes de ligar o novo quando a URL muda', async () => {
    callMethod = clientBoundTo([
      { event: 'ONIMCONNECTORMESSAGEADD', handler: 'https://antigo/webhook' },
    ])

    await ensureEventBindings({ callMethod } as never, [
      { event: 'ONIMCONNECTORMESSAGEADD', handler: HANDLER },
    ])

    expect(callsTo(callMethod, 'event.unbind')).toEqual([
      { event: 'ONIMCONNECTORMESSAGEADD', handler: 'https://antigo/webhook' },
    ])
    expect(callsTo(callMethod, 'event.bind')).toHaveLength(1)

    const methods = callMethod.mock.calls.map(call => call[0] as string)
    expect(methods.indexOf('event.unbind')).toBeLessThan(
      methods.indexOf('event.bind'),
    )
  })

  it('não mexe em handler de outro evento', async () => {
    callMethod = clientBoundTo([
      { event: 'ONCRMDEALADD', handler: 'https://outro/webhook' },
    ])

    await ensureEventBindings({ callMethod } as never, [
      { event: 'ONIMCONNECTORMESSAGEADD', handler: HANDLER },
    ])

    expect(callsTo(callMethod, 'event.unbind')).toEqual([])
  })

  it('aceita event.get devolvendo array cru', async () => {
    callMethod = vi
      .fn()
      .mockImplementation((method: string): Promise<unknown> => {
        if (method === 'event.get') {
          return Promise.resolve([
            { event: 'ONIMCONNECTORMESSAGEADD', handler: HANDLER },
          ])
        }
        return Promise.resolve({})
      })

    await ensureEventBindings({ callMethod } as never, [
      { event: 'ONIMCONNECTORMESSAGEADD', handler: HANDLER },
    ])

    expect(callsTo(callMethod, 'event.bind')).toEqual([])
  })

  describe('eventos de edição e exclusão de mensagem', () => {
    const SYNC_BINDINGS = [
      { event: 'ONIMCONNECTORMESSAGEUPDATE', handler: HANDLER },
      { event: 'ONIMCONNECTORMESSAGEDELETE', handler: HANDLER },
    ]

    it('liga os dois quando o portal não tem nenhum', async () => {
      await ensureEventBindings({ callMethod } as never, SYNC_BINDINGS)

      expect(callsTo(callMethod, 'event.bind').map(call => call.event)).toEqual(
        ['ONIMCONNECTORMESSAGEUPDATE', 'ONIMCONNECTORMESSAGEDELETE'],
      )
      expect(callsTo(callMethod, 'event.unbind')).toEqual([])
    })

    it('não faz nada quando os dois já estão no handler atual', async () => {
      callMethod = clientBoundTo(SYNC_BINDINGS)

      await ensureEventBindings({ callMethod } as never, SYNC_BINDINGS)

      expect(callsTo(callMethod, 'event.bind')).toEqual([])
      expect(callsTo(callMethod, 'event.unbind')).toEqual([])
    })

    it('troca só o que está num handler antigo, desligando antes de ligar', async () => {
      callMethod = clientBoundTo([
        { event: 'ONIMCONNECTORMESSAGEUPDATE', handler: HANDLER },
        { event: 'ONIMCONNECTORMESSAGEDELETE', handler: 'https://antigo/hook' },
      ])

      await ensureEventBindings({ callMethod } as never, SYNC_BINDINGS)

      expect(callsTo(callMethod, 'event.unbind')).toEqual([
        { event: 'ONIMCONNECTORMESSAGEDELETE', handler: 'https://antigo/hook' },
      ])
      expect(callsTo(callMethod, 'event.bind').map(call => call.event)).toEqual(
        ['ONIMCONNECTORMESSAGEDELETE'],
      )
    })
  })
})
