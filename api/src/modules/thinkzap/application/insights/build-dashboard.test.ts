import { describe, expect, it } from 'vitest'
import {
  INSIGHTS_CONFIG_DEFAULT,
  type InsightsConfig,
} from '@/modules/thinkzap/domain/insights-config'
import { buildDashboard } from './build-dashboard'
import { fakeSource, findNaN, session } from './insights-test-helpers'

const NOW = new Date('2026-11-18T15:00:00.000Z')
const cfg = (over: Partial<InsightsConfig> = {}): InsightsConfig => ({
  ...INSIGHTS_CONFIG_DEFAULT,
  ...over,
})

describe('buildDashboard', () => {
  it('período sem conversas devolve zeros, não NaN', async () => {
    const { source } = fakeSource({ sessions: [] })
    const r = await buildDashboard(
      source,
      cfg(),
      { from: '2026-11-01', to: '2026-11-10' },
      NOW,
    )
    expect(r.period).toEqual({
      from: '2026-11-01T03:00:00.000Z',
      to: '2026-11-11T02:59:59.000Z',
      days: 10,
      slaMin: 15,
    })
    expect(r.kpi).toMatchObject({
      total: 0,
      closed: 0,
      noAnswerPct: null,
      medianFirstAnswer: null,
      medianTakeover: null,
      slaPct: null,
      medianClose: null,
      crmPct: null,
      clients: 0,
      recurrentClientsPct: null,
      sessionsFromRecurrentPct: null,
    })
    expect(r.perDay).toBe(0)
    expect(r.teamTotal).toMatchObject({
      conversations: 0,
      avgFirstAnswer: null,
      avgReply: null,
      returnRate: null,
      firstOfDay: null,
      lastOfDay: null,
      daysWorked: 0,
    })
    expect(r.operators).toEqual([])
    expect(r.series).toEqual([])
    expect(r.hourly).toHaveLength(24)
    expect(r.businessHours).toEqual({
      start: 8,
      end: 18,
      days: [1, 2, 3, 4, 5],
      medianInside: null,
      medianOutside: null,
    })
    expect(findNaN(r)).toEqual([])
  })

  it('separa período atual e anterior', async () => {
    const { source, sessions } = fakeSource({
      sessions: [
        session({ id: 1, dateCreate: '2026-11-12T13:00:00.000Z' }),
        session({ id: 2, dateCreate: '2026-11-15T13:00:00.000Z' }),
        session({ id: 3, dateCreate: '2026-11-05T13:00:00.000Z' }),
        session({ id: 4, dateCreate: '2026-10-20T13:00:00.000Z' }),
      ],
    })
    const r = await buildDashboard(
      source,
      cfg(),
      { from: '2026-11-11', to: '2026-11-20' },
      NOW,
    )
    expect(sessions).toHaveBeenCalledWith(
      new Date('2026-11-01T03:00:01.000Z'),
      new Date('2026-11-11T02:59:59.000Z'),
    )
    expect(r.kpi.total).toBe(2)
    expect(r.prev.total).toBe(1)
    expect(r.perDay).toBe(0.2)
  })

  it('filtra por setor e operador sem mudar as opções de filtro', async () => {
    const { source } = fakeSource({
      sessions: [
        session({ id: 1, operatorId: 10 }),
        session({ id: 2, operatorId: 20 }),
        session({ id: 3, operatorId: null }),
      ],
    })
    const r = await buildDashboard(
      source,
      cfg(),
      { from: '2026-11-11', to: '2026-11-20', dept: '6' },
      NOW,
    )
    expect(r.kpi.total).toBe(1)
    expect(r.operators.map(o => o.name)).toEqual(['Bruno'])
    expect(r.filters).toEqual({
      departments: [
        { id: '-1', name: 'Fila / bot' },
        { id: '6', name: 'Suporte' },
        { id: '5', name: 'Vendas' },
      ],
      operators: [
        { id: 10, name: 'Ana', deptId: '5' },
        { id: 20, name: 'Bruno', deptId: '6' },
      ],
    })
  })

  it('espera usa só horário comercial quando bizOnly', async () => {
    // Cliente chamou sexta 17:50 (Brasília) e foi respondido segunda 08:10:
    // só 10 min de cada lado caem no horário comercial.
    const s = session({
      dateCreate: '2026-11-13T20:50:00.000Z',
      firstClientAt: '2026-11-13T20:50:00.000Z',
      waitAnswer: 224400,
    })
    const q = { from: '2026-11-11', to: '2026-11-17' }
    const biz = await buildDashboard(
      fakeSource({ sessions: [s] }).source,
      cfg(),
      q,
      NOW,
    )
    expect(biz.kpi.medianFirstAnswer).toBe(1200)
    expect(biz.kpi.slaPct).toBe(0)
    expect(biz.waitBuckets).toEqual({ business: { le60: 1 }, outside: {} })
    expect(biz.businessHours.medianInside).toBe(1200)
    const all = await buildDashboard(
      fakeSource({ sessions: [s] }).source,
      cfg({ bizOnly: false }),
      q,
      NOW,
    )
    expect(all.kpi.medianFirstAnswer).toBe(224400)
    expect(all.waitBuckets).toEqual({ business: { gt60: 1 }, outside: {} })
  })

  it('conversa aberta há mais de stuckDays conta como esquecida', async () => {
    const { source } = fakeSource({
      sessions: [
        session({ id: 1, dateCreate: '2026-11-14T12:00:00.000Z' }),
        session({ id: 2, dateCreate: '2026-11-17T12:00:00.000Z' }),
        session({
          id: 3,
          dateCreate: '2026-11-12T12:00:00.000Z',
          status: 'closed',
          waitAnswer: 60,
          waitClose: 4 * 86400,
        }),
      ],
    })
    const r = await buildDashboard(
      source,
      cfg(),
      { from: '2026-11-11', to: '2026-11-18' },
      NOW,
    )
    expect(r.kpi.stuck).toBe(2)
    expect(r.kpi.stuckOpen).toBe(1)
    expect(r.stuckList).toEqual([
      {
        id: 1,
        date: '2026-11-14T12:00:00.000Z',
        days: 4,
        operator: 'Ana',
        crmType: null,
        crmId: null,
      },
    ])
  })

  it('modo lean não preenche campos exclusivos da Vibe', async () => {
    const { source } = fakeSource({
      mode: 'lean',
      portal: 'acme.bitrix24.com.br',
      sessions: [
        session({ id: 1, status: 'closed', waitAnswer: 60, waitClose: 600 }),
      ],
    })
    const r = await buildDashboard(
      source,
      cfg(),
      { from: '2026-11-11', to: '2026-11-18' },
      NOW,
    )
    expect(r.mode).toBe('lean')
    expect(r.kpi).toMatchObject({
      spam: null,
      abandonPct: null,
      likes: null,
      dislikes: null,
    })
    expect(r.prev.spam).toBeNull()
    expect(r.operators[0]?.spam).toBeNull()
    expect(r.reasons).toBeNull()
    expect(r.channelSla).toBeNull()
    expect(r.portal).toBe('acme.bitrix24.com.br')
  })

  it('modo full preenche spam, motivo, nota e meta do canal', async () => {
    const { source } = fakeSource({
      mode: 'full',
      sessions: [
        session({ id: 1, status: 'spam', configId: 1 }),
        session({
          id: 2,
          status: 'closed',
          closeReason: 'auto',
          vote: 'like',
          waitAnswer: 60,
          waitClose: 600,
        }),
        session({ id: 3, status: 'closed', waitClose: 300 }),
      ],
      channelConfigs: [
        { id: 1, name: 'WhatsApp', kpiFirstAnswerTime: '300' },
        { id: 2, name: 'Outro', kpiFirstAnswerTime: '600' },
      ],
    })
    const r = await buildDashboard(
      source,
      cfg({ bizOnly: false }),
      { from: '2026-11-11', to: '2026-11-18' },
      NOW,
    )
    expect(r.mode).toBe('full')
    expect(r.kpi).toMatchObject({
      total: 2,
      spam: 1,
      abandonPct: 50,
      likes: 1,
      dislikes: 0,
      noAnswer: 1,
      noAnswerPct: 50,
    })
    expect(r.reasons).toEqual({ auto: 1, outro: 1 })
    expect(r.channelSla).toEqual([{ name: 'WhatsApp', seconds: 300 }])
  })

  it('NaN em waitAnswer é ignorado', async () => {
    const { source } = fakeSource({
      sessions: [
        session({
          id: 1,
          status: 'closed',
          waitAnswer: NaN,
          waitClose: NaN,
          replyTimes: [NaN, 60],
        }),
        session({
          id: 2,
          status: 'closed',
          waitAnswer: 120,
          waitClose: 900,
          replyTimes: [30],
        }),
      ],
    })
    const r = await buildDashboard(
      source,
      cfg({ bizOnly: false }),
      { from: '2026-11-11', to: '2026-11-18' },
      NOW,
    )
    expect(r.kpi.medianFirstAnswer).toBe(120)
    expect(r.kpi.slaPct).toBe(100)
    expect(r.kpi.medianClose).toBe(900)
    expect(r.teamTotal.avgFirstAnswer).toBe(120)
    expect(r.teamTotal.avgReply).toBe(45)
    expect(r.teamTotal.avgHandling).toBe(900)
    expect(findNaN(r)).toEqual([])
  })

  it('negócio do mesmo contato dentro da janela conta para a conversa', async () => {
    const { source, deals } = fakeSource({
      sessions: [
        session({
          id: 1,
          crmEntityType: 'contact',
          crmEntityId: 7,
          dateCreate: '2026-11-12T13:00:00.000Z',
        }),
      ],
      deals: [
        {
          id: 100,
          title: 'Venda',
          stageSemanticId: 'S',
          amount: 1000,
          currency: 'BRL',
          createdAt: '2026-11-20T13:00:00.000Z',
          contactId: 7,
          leadId: null,
        },
        {
          id: 101,
          title: 'Fora da janela',
          stageSemanticId: 'S',
          amount: 5000,
          currency: 'BRL',
          createdAt: '2026-12-30T13:00:00.000Z',
          contactId: 7,
          leadId: null,
        },
      ],
    })
    const r = await buildDashboard(
      source,
      cfg(),
      { from: '2026-11-11', to: '2026-11-18' },
      NOW,
    )
    expect(deals).toHaveBeenCalledWith([], [7], [])
    expect(r.teamTotal).toMatchObject({
      dealsTotal: 1,
      dealsWon: 1,
      wonAmount: 1000,
      convWithWon: 1,
    })
    expect(r.wonList).toEqual([
      {
        id: 100,
        title: 'Venda',
        stage: 'S',
        amount: 1000,
        currency: 'BRL',
        operator: 'Ana',
        date: '2026-11-12T13:00:00.000Z',
      },
    ])
    expect(r.operators[0]).toMatchObject({ id: 10, dealsWon: 1 })
  })

  describe('sessões incompletas', () => {
    const range = { from: '2026-11-10', to: '2026-11-10' }
    const day = (over: Record<string, unknown> = {}) =>
      session({
        dateCreate: '2026-11-10T13:00:00.000Z',
        status: 'closed',
        ...over,
      })

    it('conta só as sessões do período marcadas como incompletas', async () => {
      const { source } = fakeSource({
        mode: 'full',
        sessions: [
          day({ id: 1, incomplete: true }),
          day({ id: 2, incomplete: true }),
          day({ id: 3 }),
          // Fora do período atual: não entra na conta.
          day({
            id: 4,
            incomplete: true,
            dateCreate: '2026-11-01T13:00:00.000Z',
          }),
        ],
      })
      const r = await buildDashboard(source, cfg(), range, NOW)
      expect(r.incompleteSessions).toBe(2)
    })

    it('sem sessão incompleta, é 0', async () => {
      const { source } = fakeSource({ sessions: [day({ id: 1 })] })
      const r = await buildDashboard(source, cfg(), range, NOW)
      expect(r.incompleteSessions).toBe(0)
    })

    it('marcar como incompleta não muda nenhum indicador', async () => {
      const base = [day({ id: 1 }), day({ id: 2, waitAnswer: 30 })]
      const flagged = base.map(s => ({ ...s, incomplete: true }))
      const a = await buildDashboard(
        fakeSource({ mode: 'full', sessions: base }).source,
        cfg(),
        range,
        NOW,
      )
      const b = await buildDashboard(
        fakeSource({ mode: 'full', sessions: flagged }).source,
        cfg(),
        range,
        NOW,
      )
      expect({ ...b, incompleteSessions: 0 }).toEqual(a)
      expect(b.incompleteSessions).toBe(2)
    })
  })
})
