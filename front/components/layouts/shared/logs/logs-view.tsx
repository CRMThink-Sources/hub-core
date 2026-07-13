'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  RefreshCw,
  Search,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type LogEntry = {
  ts: number
  level: string
  msg: string
  traceKey?: string
  path?: string
  raw: Record<string, unknown>
}

type LogsResponse = { logs: LogEntry[]; count: number; truncated?: boolean }

/** Client mínimo compatível com axiosThinkzap/Importsheet/Clicksign/Thinkanalise. */
export type LogsHttpClient = {
  get<T>(url: string, config?: { params?: Record<string, unknown> }): Promise<T>
}

type Preset = '1h' | '24h' | 'custom'

const PAGE_SIZES = [10, 25, 50, 100]

const LEVEL_STYLES: Record<string, string> = {
  trace: 'bg-slate-100 text-slate-600',
  debug: 'bg-slate-100 text-slate-600',
  info: 'bg-blue-100 text-blue-700',
  warn: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
  fatal: 'bg-red-200 text-red-800',
}

// Já exibidos em colunas próprias; não repetir no detalhe.
const DETAIL_SKIP = new Set(['level', 'time', 'msg', 'path'])

function toLocalInput(ms: number): string {
  // datetime-local espera "YYYY-MM-DDTHH:mm" no fuso local.
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

type Props = {
  client: LogsHttpClient
  // Base da rota do app, ex.: '/thinkzap' → GET '/thinkzap/logs'.
  basePath: string
}

export function LogsView({ client, basePath }: Props) {
  const { t } = useTranslation('logs')

  const [preset, setPreset] = useState<Preset>('1h')
  const [customStart, setCustomStart] = useState(() =>
    toLocalInput(Date.now() - 24 * 60 * 60 * 1000),
  )
  const [customEnd, setCustomEnd] = useState(() => toLocalInput(Date.now()))
  const [search, setSearch] = useState('')

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  // Ignora respostas de requisições superadas (cliques rápidos em Buscar/preset).
  const reqIdRef = useRef(0)

  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)

  const range = useCallback((): { start: number; end: number } => {
    const now = Date.now()
    if (preset === '1h') return { start: now - 60 * 60 * 1000, end: now }
    if (preset === '24h') return { start: now - 24 * 60 * 60 * 1000, end: now }
    return {
      start: new Date(customStart).getTime(),
      end: new Date(customEnd).getTime(),
    }
  }, [preset, customStart, customEnd])

  const load = useCallback(async () => {
    const { start, end } = range()
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      setError(t('errors.invalidRange'))
      return
    }
    const reqId = ++reqIdRef.current
    setLoading(true)
    setError(null)
    try {
      const data = await client.get<LogsResponse>(`${basePath}/logs`, {
        params: {
          start,
          end,
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      })
      if (reqId !== reqIdRef.current) return
      setLogs(data.logs ?? [])
      setTruncated(data.truncated ?? false)
      setPage(1)
      setExpanded(new Set())
    } catch (err) {
      if (reqId !== reqIdRef.current) return
      setError(err instanceof Error ? err.message : t('errors.generic'))
      setLogs([])
    } finally {
      if (reqId === reqIdRef.current) setLoading(false)
    }
  }, [client, basePath, range, search, t])

  // Ao montar e a cada troca de preset (usa o `load` do render atual, já com o
  // novo preset). Custom/busca só refazem via botão Buscar.
  useEffect(() => {
    void load()
  }, [preset])

  const presetOptions = useMemo(
    () =>
      [
        { value: '1h', label: t('presets.lastHour') },
        { value: '24h', label: t('presets.last24h') },
        { value: 'custom', label: t('presets.custom') },
      ] as const,
    [t],
  )

  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIdx = (currentPage - 1) * pageSize
  const pageLogs = logs.slice(startIdx, startIdx + pageSize)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-background p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('period')}
          <select
            value={preset}
            onChange={e => setPreset(e.target.value as Preset)}
            className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm text-foreground"
          >
            {presetOptions.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {preset === 'custom' && (
          <>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {t('from')}
              <input
                type="datetime-local"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {t('to')}
              <input
                type="datetime-local"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm text-foreground"
              />
            </label>
          </>
        )}

        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground min-w-56">
          {t('search')}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void load()
            }}
            placeholder={t('searchPlaceholder')}
            className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm text-foreground"
          />
        </label>

        <div className="flex items-center gap-2">
          <Button onClick={() => void load()} disabled={loading}>
            <Search className="size-4" />
            {t('apply')}
          </Button>
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
            aria-label={t('refresh')}
          >
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {truncated && !error && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('truncated', { count: logs.length })}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-background">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-8 px-2 py-2" />
              <th className="px-3 py-2 font-medium">{t('cols.time')}</th>
              <th className="px-3 py-2 font-medium">{t('cols.level')}</th>
              <th className="px-3 py-2 font-medium">{t('cols.message')}</th>
            </tr>
          </thead>
          <tbody>
            {pageLogs.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  {t('empty')}
                </td>
              </tr>
            ) : (
              pageLogs.map((log, i) => {
                const absIdx = startIdx + i
                return (
                  <LogRow
                    key={absIdx}
                    log={log}
                    open={expanded.has(absIdx)}
                    onToggle={() =>
                      setExpanded(prev => {
                        const next = new Set(prev)
                        if (next.has(absIdx)) next.delete(absIdx)
                        else next.add(absIdx)
                        return next
                      })
                    }
                  />
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {logs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>{t('perPage')}</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-foreground"
            >
              {PAGE_SIZES.map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span>
              {t('range', {
                from: logs.length === 0 ? 0 : startIdx + 1,
                to: startIdx + pageLogs.length,
                total: logs.length,
              })}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage(1)}
                disabled={currentPage <= 1}
                aria-label={t('first')}
              >
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
                aria-label={t('prev')}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-1">
                {t('pageOf', { page: currentPage, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                aria-label={t('next')}
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage(totalPages)}
                disabled={currentPage >= totalPages}
                aria-label={t('last')}
              >
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LogRow({
  log,
  open,
  onToggle,
}: {
  log: LogEntry
  open: boolean
  onToggle: () => void
}) {
  const levelClass = LEVEL_STYLES[log.level] ?? 'bg-slate-100 text-slate-600'
  const details = Object.entries(log.raw).filter(([k]) => !DETAIL_SKIP.has(k))
  return (
    <>
      <tr
        className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/40"
        onClick={onToggle}
      >
        <td className="px-2 py-2 align-top">
          <ChevronRight
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              open && 'rotate-90',
            )}
          />
        </td>
        <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-xs text-muted-foreground">
          {new Date(log.ts).toLocaleString()}
        </td>
        <td className="px-3 py-2 align-top">
          <span
            className={cn(
              'inline-flex rounded px-1.5 py-0.5 text-xs font-medium uppercase',
              levelClass,
            )}
          >
            {log.level}
          </span>
        </td>
        <td className="px-3 py-2 align-top">{log.msg}</td>
      </tr>
      {open && (
        <tr className="border-b border-border bg-muted/20">
          <td />
          <td colSpan={3} className="px-3 py-3">
            {details.length === 0 ? (
              <p className="text-xs text-muted-foreground">—</p>
            ) : (
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
                {details.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="font-medium text-muted-foreground">{k}</dt>
                    <dd className="break-all font-mono text-foreground">
                      {formatValue(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
