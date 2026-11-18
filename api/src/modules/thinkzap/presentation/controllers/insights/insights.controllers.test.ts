import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import type { GetInsightsConfig } from '@/modules/thinkzap/application/insights/get-insights-config'
import type { GetInsightsDashboard } from '@/modules/thinkzap/application/insights/get-insights-dashboard'
import type { GetInsightsToday } from '@/modules/thinkzap/application/insights/get-insights-today'
import type { SaveInsightsConfig } from '@/modules/thinkzap/application/insights/save-insights-config'
import type {
  DashboardResult,
  TodayResult,
} from '@/modules/thinkzap/application/insights/insights-results.types'
import { INSIGHTS_CONFIG_DEFAULT } from '@/modules/thinkzap/domain/insights-config'
import { BitrixMethodPausedError } from '@/shared/infra/bitrix-limits/bitrix-limits.port'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import {
  VibecodeAuthError,
  VibecodeRequestError,
} from '@/modules/thinkzap/infra/clients/vibecode.client'
import {
  GetInsightsConfigController,
  GetInsightsDashboardController,
  GetInsightsTodayController,
  SaveInsightsConfigController,
} from './insights.controllers'

const res = {} as Response
const req = (extra: Record<string, unknown> = {}) =>
  ({
    thinkzapInstalledAppId: 'app-1',
    query: {},
    body: {},
    ...extra,
  }) as unknown as Request

const dashboardOf = (execute: GetInsightsDashboard['execute']) =>
  new GetInsightsDashboardController({ execute })

describe('GetInsightsDashboardController', () => {
  it('200 com o resultado e mode lean', async () => {
    const result = { mode: 'lean' } as DashboardResult
    const execute = vi.fn<GetInsightsDashboard['execute']>(() =>
      Promise.resolve(result),
    )
    const out = await dashboardOf(execute).perform(
      req({ query: { from: '2026-11-01', to: '2026-11-10', dept: '5' } }),
      res,
    )
    expect(execute).toHaveBeenCalledWith('app-1', {
      from: '2026-11-01',
      to: '2026-11-10',
      dept: '5',
    })
    expect(out).toEqual({ status: 200, result })
  })

  it('sem from/to segue com os padrões do caso de uso', async () => {
    const execute = vi.fn<GetInsightsDashboard['execute']>(() =>
      Promise.resolve({ mode: 'lean' } as DashboardResult),
    )
    const out = await dashboardOf(execute).perform(req(), res)
    expect(out.status).toBe(200)
    expect(execute).toHaveBeenCalledWith('app-1', {})
  })

  it.each([
    ['formato errado', { from: '01/11/2026' }],
    ['data inexistente', { to: '2026-02-31' }],
    ['array no parâmetro', { from: ['2026-11-01', '2026-11-02'] }],
    ['início depois do fim', { from: '2026-11-10', to: '2026-11-01' }],
  ])('400 em pt-BR com %s, sem chamar o caso de uso', async (_n, query) => {
    const execute = vi.fn<GetInsightsDashboard['execute']>()
    const out = await dashboardOf(execute).perform(req({ query }), res)
    expect(out.status).toBe(400)
    expect((out.result as { error: string }).error).toMatch(/período|Data/)
    expect(execute).not.toHaveBeenCalled()
  })

  it('erro do Bitrix vira 502 sem vazar a mensagem interna', async () => {
    const execute = vi.fn<GetInsightsDashboard['execute']>(() =>
      Promise.reject(new BitrixError('auth=SEGREDO falhou')),
    )
    const out = await dashboardOf(execute).perform(req(), res)
    expect(out.status).toBe(502)
    expect(JSON.stringify(out.result)).not.toContain('SEGREDO')
    expect((out.result as { error: string }).error).toContain('Bitrix')
  })

  it('pausa por limite do Bitrix também vira 502', async () => {
    const execute = vi.fn<GetInsightsDashboard['execute']>(() =>
      Promise.reject(new BitrixMethodPausedError('m', 'd', Date.now() + 1)),
    )
    const out = await dashboardOf(execute).perform(req(), res)
    expect(out.status).toBe(502)
  })

  it.each([
    ['5xx da Vibecode', new VibecodeRequestError('Falha (500)')],
    ['recusa da Vibecode sem 401/403', new VibecodeAuthError()],
    ['401 que escapou do fallback', new VibecodeAuthError(401)],
  ])('%s vira 502, nunca 500', async (_n, error) => {
    const execute = vi.fn<GetInsightsDashboard['execute']>(() =>
      Promise.reject(error),
    )
    const out = await dashboardOf(execute).perform(req(), res)
    expect(out.status).toBe(502)
  })

  it('erro desconhecido propaga para o handler genérico', async () => {
    const execute = vi.fn<GetInsightsDashboard['execute']>(() =>
      Promise.reject(new Error('bug')),
    )
    await expect(dashboardOf(execute).perform(req(), res)).rejects.toThrow(
      'bug',
    )
  })

  it('400 sem contexto do app', async () => {
    const execute = vi.fn<GetInsightsDashboard['execute']>()
    const out = await dashboardOf(execute).perform(
      req({ thinkzapInstalledAppId: undefined }),
      res,
    )
    expect(out.status).toBe(400)
  })
})

describe('GetInsightsTodayController', () => {
  it('200 repassando sources e alertMin', async () => {
    const result = { mode: 'lean' } as TodayResult
    const execute = vi.fn<GetInsightsToday['execute']>(() =>
      Promise.resolve(result),
    )
    const out = await new GetInsightsTodayController({ execute }).perform(
      req({ query: { sources: 'a,b', alertMin: '45' } }),
      res,
    )
    expect(execute).toHaveBeenCalledWith('app-1', {
      sources: 'a,b',
      alertMin: '45',
    })
    expect(out).toEqual({ status: 200, result })
  })

  it('502 quando o Bitrix falha', async () => {
    const execute = vi.fn<GetInsightsToday['execute']>(() =>
      Promise.reject(new BitrixError('x')),
    )
    const out = await new GetInsightsTodayController({ execute }).perform(
      req(),
      res,
    )
    expect(out.status).toBe(502)
  })
})

describe('Insights config controllers', () => {
  it('GET devolve a config do app', async () => {
    const execute = vi.fn<GetInsightsConfig['execute']>(() =>
      Promise.resolve(INSIGHTS_CONFIG_DEFAULT),
    )
    const out = await new GetInsightsConfigController({ execute }).perform(
      req(),
      res,
    )
    expect(execute).toHaveBeenCalledWith('app-1')
    expect(out).toEqual({ status: 200, result: INSIGHTS_CONFIG_DEFAULT })
  })

  // A restrição a admin não é do controller: a rota PUT /insights/config entra
  // atrás de `requireThinkzapAdmin` em routes.ts, igual à chave Vibecode.
  it('PUT repassa o subconjunto e devolve o salvo', async () => {
    const execute = vi.fn<SaveInsightsConfig['execute']>(() =>
      Promise.resolve({ ...INSIGHTS_CONFIG_DEFAULT, refMin: 20 }),
    )
    const out = await new SaveInsightsConfigController({ execute }).perform(
      req({ body: { refMin: '20', bizOnly: false } }),
      res,
    )
    expect(execute).toHaveBeenCalledWith('app-1', {
      refMin: '20',
      bizOnly: false,
    })
    expect(out.status).toBe(200)
  })

  it('PUT com corpo que não é objeto vira 400', async () => {
    const execute = vi.fn<SaveInsightsConfig['execute']>()
    const out = await new SaveInsightsConfigController({ execute }).perform(
      req({ body: [1] }),
      res,
    )
    expect(out.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })
})
