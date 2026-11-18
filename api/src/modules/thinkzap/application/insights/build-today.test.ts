import { describe, expect, it } from 'vitest'
import { INSIGHTS_CONFIG_DEFAULT } from '@/modules/thinkzap/domain/insights-config'
import { buildToday } from './build-today'
import { fakeSource, session } from './insights-test-helpers'

// 12:00 em Brasília
const NOW = new Date('2026-11-18T15:00:00.000Z')

const sessions = [
  session({ id: 1, status: 'new', dateCreate: '2026-11-18T14:00:00.000Z' }),
  session({
    id: 2,
    status: 'answered',
    waitAnswer: 60,
    dateCreate: '2026-11-18T14:50:00.000Z',
    crmEntityType: 'deal',
    crmEntityId: 9,
  }),
  session({
    id: 3,
    status: 'closed',
    waitAnswer: 30,
    dateCreate: '2026-11-18T12:00:00.000Z',
  }),
  session({
    id: 4,
    status: 'paused',
    operatorId: null,
    chatId: 44,
    dateCreate: '2026-11-17T14:00:00.000Z',
  }),
  session({ id: 5, status: 'spam', dateCreate: '2026-11-18T13:00:00.000Z' }),
  session({
    id: 6,
    status: 'new',
    source: 'whatsapp_nativo',
    configId: 99,
    dateCreate: '2026-11-18T14:00:00.000Z',
  }),
  session({ id: 7, status: 'new', dateCreate: '2026-11-10T14:00:00.000Z' }),
]

describe('buildToday', () => {
  it('lista abertas dos últimos 7 dias com atrasadas primeiro', async () => {
    const { source, sessions: read } = fakeSource({ sessions })
    const r = await buildToday(source, INSIGHTS_CONFIG_DEFAULT, {}, NOW)
    expect(read).toHaveBeenCalledWith(new Date('2026-11-11T15:00:00.000Z'), NOW)
    expect(r.alertMin).toBe(30)
    expect(r.open).toEqual([
      {
        id: 4,
        chatId: 44,
        status: 'paused',
        operator: 'Sem atendente',
        dept: 'Fila / bot',
        ageMin: 1500,
        waitingFirstAnswer: true,
        late: true,
        crm: null,
      },
      {
        id: 1,
        chatId: 1,
        status: 'new',
        operator: 'Ana',
        dept: 'Vendas',
        ageMin: 60,
        waitingFirstAnswer: true,
        late: true,
        crm: null,
      },
      {
        id: 2,
        chatId: 1,
        status: 'answered',
        operator: 'Ana',
        dept: 'Vendas',
        ageMin: 10,
        waitingFirstAnswer: false,
        late: false,
        crm: 'deal 9',
      },
    ])
    expect(r.late).toBe(2)
    expect(r.today).toEqual({ total: 3, closed: 1, open: 2 })
  })

  it('alertMin da query muda o que é atrasado', async () => {
    const { source } = fakeSource({ sessions })
    const r = await buildToday(
      source,
      INSIGHTS_CONFIG_DEFAULT,
      { alertMin: '90' },
      NOW,
    )
    expect(r.alertMin).toBe(90)
    expect(r.late).toBe(1)
  })

  it('modo lean não consulta operadores ao vivo', async () => {
    const { source, operators } = fakeSource({ mode: 'lean', sessions })
    const r = await buildToday(source, INSIGHTS_CONFIG_DEFAULT, {}, NOW)
    expect(r.mode).toBe('lean')
    expect(r.operators).toEqual([])
    expect(operators).not.toHaveBeenCalled()
  })

  it('modo full agrega operadores dos canais do ThinkZap', async () => {
    const { source } = fakeSource({
      mode: 'full',
      sessions,
      users: { '10': 'Ana', '20': 'Bruno', '30': 'Caio' },
      operators: [
        { userId: 20, configId: 1, status: 'offline' },
        { userId: 10, configId: 1, status: 'online', activeSessions: 2 },
        { userId: 10, configId: 1, status: 'offline', activeSessions: 1 },
        { userId: 30, configId: 99, status: 'online', activeSessions: 4 },
      ],
    })
    const r = await buildToday(source, INSIGHTS_CONFIG_DEFAULT, {}, NOW)
    expect(r.mode).toBe('full')
    expect(r.operators).toEqual([
      {
        userId: 10,
        name: 'Ana',
        dept: 'Vendas',
        status: 'online',
        activeSessions: 3,
      },
      {
        userId: 20,
        name: 'Bruno',
        dept: 'Suporte',
        status: 'offline',
        activeSessions: 0,
      },
    ])
  })
})
