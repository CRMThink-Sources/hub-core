'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatPortalDate } from '@/lib/format-date'
import {
  INBOUND_SOURCES,
  listInboundFailures,
  reprocessInboundFailure,
  type InboundFailureStatus,
  type InboundSource,
  type ListInboundFailuresResponse,
} from '@/lib/inbound-failures'
import { AdminInboundFailureDetail } from './admin-inbound-failure-detail'
import { InboundStatusBadge } from './admin-inbound-status-badge'
import {
  AdminReprocessDialog,
  type ReprocessTarget,
} from './admin-reprocess-dialog'
import { dayBoundary, earliestDay } from './failures-date-range'

const PAGE_SIZE = 20
const NS = 'admin/message-failures'

type Filters = {
  domain: string
  status: 'all' | InboundFailureStatus
  source: 'all' | InboundSource
  /** `YYYY-MM-DD` do input de data; vazio = padrão da API (o prazo de guarda). */
  from: string
  to: string
}

const EMPTY_FILTERS: Filters = {
  domain: '',
  status: 'all',
  source: 'all',
  from: '',
  to: '',
}

/** A aba "Recebimento" da tela de falhas: eventos recebidos que esgotaram as tentativas. */
export function AdminInboundFailuresPanel({
  initialDomain = '',
}: {
  /** Portal pré-filtrado (link da página do cliente). */
  initialDomain?: string
}) {
  const { t, i18n } = useTranslation(NS)
  const { t: tCommon } = useTranslation('common')
  const locale = i18n.language

  const [draft, setDraft] = useState<Filters>({
    ...EMPTY_FILTERS,
    domain: initialDomain,
  })
  const [filters, setFilters] = useState<Filters>({
    ...EMPTY_FILTERS,
    domain: initialDomain,
  })
  const [page, setPage] = useState(1)
  const [reloadCounter, setReloadCounter] = useState(0)

  const [data, setData] = useState<ListInboundFailuresResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const [openId, setOpenId] = useState<string | null>(null)
  const [target, setTarget] = useState<ReprocessTarget | null>(null)
  const [isReprocessing, setIsReprocessing] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setHasError(false)
      try {
        const result = await listInboundFailures({
          page,
          limit: PAGE_SIZE,
          ...(filters.status !== 'all' && { status: filters.status }),
          ...(filters.source !== 'all' && { source: filters.source }),
          ...(filters.domain.trim() && { domain: filters.domain.trim() }),
          from: dayBoundary(filters.from, 'start'),
          to: dayBoundary(filters.to, 'end'),
        })
        if (!cancelled) setData(result)
      } catch {
        if (!cancelled) {
          setHasError(true)
          setData(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [page, filters, reloadCounter])

  const retentionDays = data?.retentionDays
  const items = useMemo(() => data?.items ?? [], [data])
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  const isEmpty = !isLoading && !hasError && items.length === 0

  function reload() {
    setReloadCounter(c => c + 1)
  }

  function applyFilters() {
    setFilters(draft)
    setPage(1)
  }

  function askReprocess(id: string) {
    // Recebimento não tem "resultado indeterminado": nunca exige o aceite de duplicidade.
    setTarget({ ids: [id], unknownCount: 0 })
  }

  async function confirmReprocess() {
    if (!target) return
    setIsReprocessing(true)
    try {
      const status = await reprocessInboundFailure(target.ids[0])
      if (status === 'requeued') toast.success(t(`inbound.result.${status}`))
      else toast.warning(t(`inbound.result.${status}`))
      reload()
    } catch {
      toast.error(t('inbound.reprocessError'))
    } finally {
      setIsReprocessing(false)
      setTarget(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="max-w-3xl text-muted-foreground">
            {t('inbound.description')}
          </p>
          {retentionDays !== undefined && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t('retentionNotice', { days: retentionDays })}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          className="shrink-0"
          onClick={reload}
          disabled={isLoading}
        >
          <RefreshCw className="size-4" />
          {t('inbound.refresh')}
        </Button>
      </div>

      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={event => {
          event.preventDefault()
          applyFilters()
        }}
      >
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="inbound-domain">
            {t('inbound.filterDomain')}
          </FieldLabel>
          <Input
            id="inbound-domain"
            className="w-56"
            placeholder={t('inbound.filterDomainPlaceholder')}
            value={draft.domain}
            onChange={event =>
              setDraft(d => ({ ...d, domain: event.target.value }))
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="inbound-status">
            {t('inbound.filterStatus')}
          </FieldLabel>
          <Select
            value={draft.status}
            onValueChange={(value: string | null) =>
              setDraft(d => ({
                ...d,
                status: (value ?? 'all') as Filters['status'],
              }))
            }
          >
            <SelectTrigger id="inbound-status" className="w-44">
              <SelectValue>
                {(value: string) =>
                  value === 'all'
                    ? t('inbound.filterAll')
                    : t(`inbound.status.${value}`)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('inbound.filterAll')}</SelectItem>
              <SelectItem value="FAILED">
                {t('inbound.status.FAILED')}
              </SelectItem>
              <SelectItem value="REPROCESSED">
                {t('inbound.status.REPROCESSED')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="inbound-source">
            {t('inbound.filterSource')}
          </FieldLabel>
          <Select
            value={draft.source}
            onValueChange={(value: string | null) =>
              setDraft(d => ({
                ...d,
                source: (value ?? 'all') as Filters['source'],
              }))
            }
          >
            <SelectTrigger id="inbound-source" className="w-60">
              <SelectValue>
                {(value: string) =>
                  value === 'all'
                    ? t('inbound.filterAll')
                    : t(`inbound.source.${value}`)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('inbound.filterAll')}</SelectItem>
              {INBOUND_SOURCES.map(source => (
                <SelectItem key={source} value={source}>
                  {t(`inbound.source.${source}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="inbound-from">
            {t('inbound.filterFrom')}
          </FieldLabel>
          <Input
            id="inbound-from"
            type="date"
            className="w-40"
            min={retentionDays ? earliestDay(retentionDays) : undefined}
            value={draft.from}
            onChange={event =>
              setDraft(d => ({ ...d, from: event.target.value }))
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="inbound-to">{t('inbound.filterTo')}</FieldLabel>
          <Input
            id="inbound-to"
            type="date"
            className="w-40"
            min={retentionDays ? earliestDay(retentionDays) : undefined}
            value={draft.to}
            onChange={event =>
              setDraft(d => ({ ...d, to: event.target.value }))
            }
          />
        </div>

        <Button type="submit" variant="outline">
          {t('inbound.applyFilters')}
        </Button>
      </form>

      {isLoading && !data ? (
        <p className="text-sm text-muted-foreground">{tCommon('carregando')}</p>
      ) : hasError ? (
        <div className="admin-card p-6">
          <h2 className="text-lg font-medium text-foreground">
            {t('inbound.errorTitle')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('inbound.errorDescription')}
          </p>
          <Button variant="outline" className="mt-4" onClick={reload}>
            {t('inbound.retry')}
          </Button>
        </div>
      ) : isEmpty ? (
        <div className="admin-card p-6">
          <h2 className="text-lg font-medium text-foreground">
            {t('inbound.emptyTitle')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('inbound.emptyDescription')}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-background">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">
                    {t('inbound.table.createdAt')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('inbound.table.domain')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('inbound.table.source')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('inbound.table.type')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('inbound.table.status')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('inbound.table.error')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t('inbound.table.attempts')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t('inbound.table.action')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr
                    key={item.id}
                    tabIndex={0}
                    onClick={() => setOpenId(item.id)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        setOpenId(item.id)
                      }
                    }}
                    className="cursor-pointer border-b border-border align-top last:border-b-0 hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none"
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap text-foreground">
                      {formatPortalDate(item.createdAt, locale)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.domainName ?? item.domainId ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t(`inbound.source.${item.source}`)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.type || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <InboundStatusBadge status={item.status} />
                    </td>
                    <td className="min-w-64 max-w-sm px-4 py-3 break-words text-red-700 dark:text-red-400">
                      {item.errorMessage}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                      {item.attempts}
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={event => event.stopPropagation()}
                    >
                      {item.reprocessable ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => askReprocess(item.id)}
                        >
                          <RotateCcw className="size-3.5" />
                          {t('inbound.reprocess')}
                        </Button>
                      ) : item.status === 'FAILED' ? (
                        <span
                          className="text-xs text-muted-foreground"
                          title={t('inbound.notReprocessableHint')}
                        >
                          {t('inbound.notReprocessable')}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {t('inbound.reprocessedTimes', {
                            count: item.reprocessCount,
                          })}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t('inbound.page', { current: page, total: totalPages })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  {t('inbound.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  {t('inbound.next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <AdminInboundFailureDetail
        id={openId}
        reloadKey={reloadCounter}
        onClose={() => setOpenId(null)}
        onReprocess={failure => askReprocess(failure.id)}
      />

      <AdminReprocessDialog
        target={target}
        title={t('inbound.confirmTitle')}
        description={t('inbound.confirmDescription')}
        isReprocessing={isReprocessing}
        acknowledged={false}
        onAcknowledgedChange={() => {}}
        onConfirm={() => void confirmReprocess()}
        onCancel={() => setTarget(null)}
      />
    </div>
  )
}
