import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { ensurePlacementBindings } from './ensure-placement-bindings'

const HANDLER = 'https://app.test/placement'
const OWNED = [HANDLER, 'https://app.test/audio']

const binding = {
  PLACEMENT: 'CRM_DEAL_DETAIL_TAB',
  HANDLER,
  TITLE: 'ThinkZap',
}

function clientWith(installed: Array<{ PLACEMENT: string; HANDLER: string }>): {
  callMethod: ReturnType<typeof vi.fn>
} {
  const callMethod = vi
    .fn()
    .mockImplementation((method: string): Promise<unknown> => {
      if (method === 'placement.get') return Promise.resolve(installed)
      return Promise.resolve({})
    })

  return { callMethod }
}

function callsTo(
  client: { callMethod: ReturnType<typeof vi.fn> },
  method: string,
): Array<Record<string, unknown>> {
  return client.callMethod.mock.calls
    .filter(call => call[0] === method)
    .map(call => call[1] as Record<string, unknown>)
}

describe('ensurePlacementBindings', () => {
  let client: ReturnType<typeof clientWith>

  beforeEach(() => {
    client = clientWith([])
  })

  it('vincula placement ainda não registrado', async () => {
    await ensurePlacementBindings(client as never, [binding], OWNED)

    expect(callsTo(client, 'placement.bind')).toEqual([binding])
  })

  it('não rebinda placement já registrado no mesmo handler', async () => {
    client = clientWith([{ PLACEMENT: 'CRM_DEAL_DETAIL_TAB', HANDLER }])

    await ensurePlacementBindings(client as never, [binding], OWNED)

    expect(callsTo(client, 'placement.bind')).toEqual([])
    expect(callsTo(client, 'placement.unbind')).toEqual([])
  })

  it('substitui o placement quando o handler do app mudou', async () => {
    client = clientWith([
      { PLACEMENT: 'CRM_DEAL_DETAIL_TAB', HANDLER: 'https://app.test/audio' },
    ])

    await ensurePlacementBindings(client as never, [binding], OWNED)

    expect(callsTo(client, 'placement.unbind')).toEqual([
      { PLACEMENT: 'CRM_DEAL_DETAIL_TAB', HANDLER: 'https://app.test/audio' },
    ])
    expect(callsTo(client, 'placement.bind')).toEqual([binding])
  })

  it('não remove placement do mesmo tipo registrado por outro app', async () => {
    client = clientWith([
      { PLACEMENT: 'CRM_DEAL_DETAIL_TAB', HANDLER: 'https://outroapp/tab' },
    ])

    await ensurePlacementBindings(client as never, [binding], OWNED)

    expect(callsTo(client, 'placement.unbind')).toEqual([])
    expect(callsTo(client, 'placement.bind')).toEqual([binding])
  })
})
