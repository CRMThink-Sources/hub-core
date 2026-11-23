import type { DashboardQuery, TodayQuery } from './insights-results.types'

const DAY_MS = 864e5
// Brasília (UTC-3, sem horário de verão desde 2019): é o dia em que o Insights divide os períodos.
const BRT_OFFSET_MS = 3 * 3600e3
const DEFAULT_PERIOD_DAYS = 7

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/**
 * Consulta que a tela do Desempenho faz ao abrir: os últimos 7 dias contando
 * hoje, sem filtros, nas granularidades padrão.
 *
 * **Precisa coincidir com o front** (`defaultPeriod` em `front/lib/insights-format.ts`
 * e o estado inicial de `insights/page.tsx`: `g = 'total'`, `sg = 'day'`): a chave
 * do resultado pré-aquecido sai da consulta, e uma diferença de uma data ou de um
 * parâmetro faz a abertura real não encontrar o que foi calculado por antecipação.
 * O front usa o dia do relógio do navegador e aqui é o de Brasília; perto da
 * meia-noite os dois podem diferir, e então a abertura cai no cálculo normal.
 */
export function defaultDashboardQuery(nowMs: number): DashboardQuery {
  const today = nowMs - BRT_OFFSET_MS
  return {
    from: isoDay(today - (DEFAULT_PERIOD_DAYS - 1) * DAY_MS),
    to: isoDay(today),
    g: 'total',
    sg: 'day',
  }
}

/**
 * Consulta do "Agora": a tela passa o tempo de referência configurado do app
 * (`refMin`) como `alertMin`. A API recebe query string, então o valor é texto.
 */
export function defaultTodayQuery(refMin: number): TodayQuery {
  return { alertMin: String(refMin) }
}
