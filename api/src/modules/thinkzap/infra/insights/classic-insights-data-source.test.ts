import { describe, expect, it, vi } from 'vitest'
import { buildDashboard } from '@/modules/thinkzap/application/insights/build-dashboard'
import { INSIGHTS_CONFIG_DEFAULT } from '@/modules/thinkzap/domain/insights-config'
import { apiLogger } from '@/shared/infra/logger'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ClassicInsightsDataSource } from './classic-insights-data-source'

type Call = BitrixClient['callMethod']

const act = (id: number, over: Record<string, unknown> = {}) => ({
  ID: String(id),
  RESPONSIBLE_ID: '7',
  START_TIME: '2026-11-10T10:00:00-03:00',
  END_TIME: '2026-11-10T10:10:00-03:00',
  COMPLETED: 'N',
  OWNER_TYPE_ID: '2',
  OWNER_ID: '99',
  SUBJECT: 'Chat "Linha - Vendas"',
  ASSOCIATED_ENTITY_ID: String(id),
  ...over,
})

const history = {
  chatId: 5,
  users: {
    '1': { connector: true, name: 'Cliente' },
    '7': { name: 'Ana' },
  },
  message: {
    a: { id: 1, senderid: '1', date: '2026-11-10T10:00:00-03:00', text: 'oi' },
    b: { id: 2, senderid: '7', date: '2026-11-10T10:01:00-03:00', text: 'olá' },
  },
}

const from = new Date('2026-11-01T00:00:00Z')
const to = new Date('2026-11-30T00:00:00Z')

function make(handler: (method: string, params: any) => unknown) {
  // handler pode lançar: o then converte em rejeição, como o cliente real
  const callMethod = vi.fn<Call>(((method: string, params: unknown) =>
    Promise.resolve().then(() => handler(method, params))) as Call)
  return {
    callMethod,
    ds: new ClassicInsightsDataSource({ callMethod: callMethod as Call }, 'p'),
  }
}

describe('ClassicInsightsDataSource', () => {
  it('para a paginação ao passar da data inicial', async () => {
    const { ds, callMethod } = make(method => {
      if (method === 'crm.activity.list')
        return {
          result: [act(2, { START_TIME: '2026-01-01T00:00:00-03:00' })],
          next: 50,
        }
      return { result: { result: {} } }
    })
    await ds.sessions(from, to)
    const pages = callMethod.mock.calls.filter(
      c => c[0] === 'crm.activity.list',
    )
    expect(pages).toHaveLength(1)
  })

  it('mapeia sessão fechada com waitClose', async () => {
    const { ds } = make(method => {
      if (method === 'crm.activity.list')
        return { result: [act(3, { COMPLETED: 'Y' })] }
      return { result: { result: { s3: history } } }
    })
    const [s] = await ds.sessions(from, to)
    expect(s).toMatchObject({
      id: 3,
      status: 'closed',
      waitClose: 600,
      waitAnswer: 60,
      operatorId: 7,
      crmEntityType: 'deal',
      crmEntityId: 99,
      chatId: 5,
      line: 'Vendas',
      msgsOperator: 1,
      msgsClient: 1,
    })
  })

  it('identifica ThinkZap pelo SUBJECT', async () => {
    const { ds } = make(method => {
      if (method === 'crm.activity.list')
        return { result: [act(4, { SUBJECT: 'ThinkZap - Comercial"' })] }
      return { result: { result: {} } }
    })
    const [s] = await ds.sessions(from, to)
    expect(s?.source).toBe('hubthink_thinkzap')
  })

  it('usa batch de no máximo 50 históricos', async () => {
    const { ds, callMethod } = make(method => {
      if (method === 'crm.activity.list')
        return { result: Array.from({ length: 120 }, (_, i) => act(i + 1)) }
      return { result: { result: {} } }
    })
    await ds.sessions(from, to)
    const batches = callMethod.mock.calls.filter(c => c[0] === 'batch')
    expect(batches).toHaveLength(3)
    for (const [, p] of batches)
      expect(
        Object.keys((p as { cmd: object }).cmd).length,
      ).toBeLessThanOrEqual(50)
  })

  it('ignora mensagens com data inválida em vez de propagar NaN', async () => {
    const bad = {
      ...history,
      message: {
        ...history.message,
        c: { id: 3, senderid: '7', date: 'lixo', text: 'x' },
      },
    }
    const { ds } = make(method => {
      if (method === 'crm.activity.list') return { result: [act(5)] }
      return { result: { result: { s5: bad } } }
    })
    const [s] = await ds.sessions(from, to)
    expect(s?.replyTimes.every(n => Number.isFinite(n))).toBe(true)
    expect(s?.msgsOperator).toBe(1)
  })

  it('reaproveita as sessões já lidas dentro do cache', async () => {
    const { ds, callMethod } = make(method => {
      if (method === 'crm.activity.list') return { result: [act(6)] }
      return { result: { result: {} } }
    })
    await ds.sessions(from, to)
    await ds.sessions(from, to)
    expect(
      callMethod.mock.calls.filter(c => c[0] === 'crm.activity.list'),
    ).toHaveLength(1)
  })

  it('um painel completo faz uma única varredura, não duas', async () => {
    const { ds, callMethod } = make(method => {
      if (method === 'crm.activity.list') return { result: [act(7)] }
      return { result: { result: {} } }
    })
    await buildDashboard(
      ds,
      INSIGHTS_CONFIG_DEFAULT,
      { from: '2026-11-01', to: '2026-11-10' },
      new Date('2026-11-18T15:00:00.000Z'),
    )
    expect(
      callMethod.mock.calls.filter(c => c[0] === 'crm.activity.list'),
    ).toHaveLength(1)
  })

  it('varredura curta que termina depois não encolhe o cache', async () => {
    let release!: () => void
    const gate = new Promise<void>(r => (release = r))
    let listCalls = 0
    const { ds, callMethod } = make(method => {
      if (method === 'crm.activity.list') {
        const n = ++listCalls
        // A primeira (a curta) fica presa até a longa terminar.
        return n === 1
          ? gate.then(() => ({ result: [act(8)] }))
          : { result: [act(8)] }
      }
      return { result: { result: {} } }
    })
    const shortP = ds.sessions(new Date('2026-11-09T00:00:00Z'), to)
    await new Promise(r => setTimeout(r, 0))
    await ds.sessions(from, to)
    release()
    await shortP
    await ds.sessions(from, to)
    expect(
      callMethod.mock.calls.filter(c => c[0] === 'crm.activity.list'),
    ).toHaveLength(2)
  })

  it('para a paginação no teto de 200 páginas e avisa uma vez', async () => {
    const warn = vi.spyOn(apiLogger, 'warn').mockImplementation(() => undefined)
    const { ds, callMethod } = make((method, params) => {
      if (method === 'crm.activity.list')
        return {
          result: [act(9)],
          next: (params as { start: number }).start + 50,
        }
      return { result: { result: {} } }
    })
    await ds.sessions(from, to)
    expect(
      callMethod.mock.calls.filter(c => c[0] === 'crm.activity.list'),
    ).toHaveLength(200)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('directory sem escopo de departamento não quebra', async () => {
    const { ds } = make(method => {
      if (method === 'department.get') throw new Error('insufficient scope')
      if (method === 'user.get')
        return {
          result: [
            { ID: '7', NAME: 'Ana', LAST_NAME: 'Lima', UF_DEPARTMENT: [3] },
          ],
        }
      if (method === 'crm.activity.list') return { result: [] }
      return { result: { result: {} } }
    })
    const d = await ds.directory()
    expect(d.users['7']).toBe('Ana Lima')
    expect(d.userDept['7']).toEqual({ id: 0, name: 'Sem setor' })
  })

  it('operators devolve vazio e o modo é lean', async () => {
    const { ds } = make(() => ({ result: [] }))
    expect(await ds.operators()).toEqual([])
    expect(ds.mode).toBe('lean')
  })
})
