import { describe, expect, it } from 'vitest'
import { defaultDashboardQuery, defaultTodayQuery } from './default-queries'
import { insightsQueryHash } from './insights-keys'

describe('defaultDashboardQuery', () => {
  // Mesmo cenário do teste de `defaultPeriod` no front
  // (`front/lib/insights-format.test.ts`): 18/11/2026 23:30 → 12/11 a 18/11.
  // Se um dos dois mudar a regra, este e aquele deixam de bater: o
  // pré-aquecimento passa a calcular uma consulta que ninguém faz.
  it('últimos 7 dias contando hoje, no dia de Brasília', () => {
    const at2330 = Date.parse('2026-11-18T23:30:00-03:00')
    expect(defaultDashboardQuery(at2330)).toMatchObject({
      from: '2026-11-12',
      to: '2026-11-18',
    })
  })

  it('às 23h30 de Brasília o UTC já é o dia seguinte e o período não anda', () => {
    expect(Date.parse('2026-11-18T23:30:00-03:00')).toBe(
      Date.parse('2026-11-19T02:30:00Z'),
    )
    expect(defaultDashboardQuery(Date.parse('2026-11-19T02:30:00Z')).to).toBe(
      '2026-11-18',
    )
  })

  it('vira o dia à meia-noite de Brasília', () => {
    expect(
      defaultDashboardQuery(Date.parse('2026-11-19T00:00:00-03:00')).to,
    ).toBe('2026-11-19')
    expect(
      defaultDashboardQuery(Date.parse('2026-11-18T23:59:59-03:00')).to,
    ).toBe('2026-11-18')
  })

  it('atravessa o fim do mês e do ano', () => {
    expect(
      defaultDashboardQuery(Date.parse('2026-01-03T12:00:00-03:00')),
    ).toMatchObject({ from: '2025-12-28', to: '2026-01-03' })
  })

  it('usa as granularidades padrão da tela e nenhum filtro', () => {
    const q = defaultDashboardQuery(Date.parse('2026-11-18T12:00:00-03:00'))
    expect(q.g).toBe('total')
    expect(q.sg).toBe('day')
    expect(q).not.toHaveProperty('dept')
    expect(q).not.toHaveProperty('operator')
  })

  it('gera a mesma chave da consulta que a tela envia (filtros vazios não contam)', () => {
    const fromScreen = {
      from: '2026-11-12',
      to: '2026-11-18',
      dept: '',
      operator: '',
      g: 'total',
      sg: 'day',
    }
    expect(
      insightsQueryHash(
        'dashboard',
        defaultDashboardQuery(Date.parse('2026-11-18T12:00:00-03:00')),
      ),
    ).toBe(insightsQueryHash('dashboard', fromScreen))
  })
})

describe('defaultDashboardQuery — dia do cliente diferente do de Brasília', () => {
  // Perto da meia-noite o relógio do navegador pode estar no dia seguinte ao de
  // Brasília (cliente em outro fuso). A consulta dele tem outra chave: não
  // encontra o resultado pré-aquecido e cai no cálculo normal, que continua
  // correto (e barato, com os dias fechados em cache).
  it('gera outra chave, sem erro', () => {
    const brt = defaultDashboardQuery(Date.parse('2026-11-18T23:30:00-03:00'))
    const clientAheadOneDay = { ...brt, from: '2026-11-13', to: '2026-11-19' }
    expect(insightsQueryHash('dashboard', clientAheadOneDay)).not.toBe(
      insightsQueryHash('dashboard', brt),
    )
  })
})

describe('defaultTodayQuery', () => {
  it('manda o refMin como texto, como chega da query string', () => {
    expect(defaultTodayQuery(15)).toEqual({ alertMin: '15' })
    expect(insightsQueryHash('today', defaultTodayQuery(15))).toBe(
      insightsQueryHash('today', { alertMin: '15' }),
    )
  })
})
