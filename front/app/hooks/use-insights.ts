import { useCallback, useEffect, useState } from 'react'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { APP_CODES } from '@/shared/app/app-codes'
import { appTokenKey } from '@/shared/auth/app-token-storage'
import { extractThinkzapError } from './extract-thinkzap-error'
import type {
  DashboardQuery,
  DashboardResult,
  InsightsConfig,
  TodayResult,
} from './insights-types'

const BASE = '/thinkzap/insights'

/** Filtro vazio não vai na URL: a API trata ausente como "todos". */
export function dashboardPath(query: DashboardQuery): string {
  const params = new URLSearchParams()
  const entries: [string, string | number | undefined][] = [
    ['from', query.from],
    ['to', query.to],
    ['dept', query.dept],
    ['operator', query.operator],
    ['slaMin', query.slaMin],
    ['sources', query.sources],
    ['g', query.g],
    ['sg', query.sg],
  ]
  for (const [key, value] of entries) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${BASE}/dashboard?${qs}` : `${BASE}/dashboard`
}

export function todayPath(alertMin: number | null): string {
  return alertMin == null
    ? `${BASE}/today`
    : `${BASE}/today?alertMin=${alertMin}`
}

const client = () => axiosThinkzap(appTokenKey(APP_CODES.thinkzap))

type Remote<T> = {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * GET com descarte da resposta atrasada: trocar o filtro rápido dispara duas
 * leituras, e a mais lenta não pode sobrescrever a mais nova. O dado anterior
 * fica na tela durante o recarregamento (a página só esmaece), como no
 * original. `path` null = ainda não dá para buscar (ex.: config não chegou).
 */
function useRemote<T>(path: string | null, fallbackError: string): Remote<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(path !== null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (path === null) return
    let stale = false
    setLoading(true)
    setError(null)
    const run = async () => {
      try {
        const result = await client().get<T>(path)
        if (!stale) setData(result)
      } catch (err: unknown) {
        if (!stale) setError(extractThinkzapError(err, fallbackError))
      } finally {
        if (!stale) setLoading(false)
      }
    }
    void run()
    return () => {
      stale = true
    }
  }, [path, nonce, fallbackError])

  const reload = useCallback(() => setNonce(n => n + 1), [])
  return { data, loading, error, reload }
}

export function useInsightsDashboard(
  query: DashboardQuery | null,
  fallbackError: string,
): Remote<DashboardResult> {
  return useRemote<DashboardResult>(
    query ? dashboardPath(query) : null,
    fallbackError,
  )
}

export function useInsightsToday(
  alertMin: number | null,
  enabled: boolean,
  fallbackError: string,
): Remote<TodayResult> {
  return useRemote<TodayResult>(
    enabled ? todayPath(alertMin) : null,
    fallbackError,
  )
}

/**
 * Configuração do painel por portal. Salvar é só de admin (a rota exige
 * `requireThinkzapAdmin`); a API normaliza os limites e devolve o que gravou,
 * que passa a ser o estado da tela.
 */
export function useInsightsConfig(fallbackError: string) {
  const remote = useRemote<InsightsConfig>(`${BASE}/config`, fallbackError)
  const [saved, setSaved] = useState<InsightsConfig | null>(null)

  const save = useCallback(
    async (
      patch: Partial<InsightsConfig>,
      saveError: string,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      try {
        const next = await client().put<InsightsConfig>(`${BASE}/config`, patch)
        setSaved(next)
        return { ok: true }
      } catch (err: unknown) {
        return { ok: false, error: extractThinkzapError(err, saveError) }
      }
    },
    [],
  )

  return {
    config: saved ?? remote.data,
    loading: remote.loading,
    error: remote.error,
    save,
  }
}
