'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatPortalDate } from '@/lib/format-date'
import {
  OUTBOX_ORIGINS,
  listOutboxFailures,
  reprocessOutboxFailure,
  reprocessOutboxFailures,
  summarizeReprocess,
  type ListOutboxFailuresResponse,
  type OutboxFailure,
  type OutboxFailureStatus,
  type OutboxOrigin,
} from '@/lib/outbox-failures'
import { AdminOutboxFailureDetail } from './admin-outbox-failure-detail'
import { OutboxStatusBadge } from './admin-outbox-status-badge'

const PAGE_SIZE = 20
const NS = 'admin/outbox-failures'

type Filters = {
  domain: string
  status: 'all' | OutboxFailureStatus
  origin: 'all' | OutboxOrigin
  /** `YYYY-MM-DD` do input de data; vazio = padrão da API (últimos 7 dias). */
  from: string
  to: string
}

const EMPTY_FILTERS: Filters = {
  domain: '',
  status: 'all',
  origin: 'all',
  from: '',
  to: '',
}

/** Início e fim do dia **local** escolhido, em ISO para a API. */
function dayBoundary(day: string, edge: 'start' | 'end'): string | undefined {
  if (!day) return undefined
  const [year, month, date] = day.split('-').map(Number)
  const value =
    edge === 'start'
      ? new Date(year, month - 1, date, 0, 0, 0, 0)
      : new Date(year, month - 1, date, 23, 59, 59, 999)
  return value.toISOString()
}

/** O que reprocessar e quais deles são `UNKNOWN` (exigem o aceite de duplicidade). */
export type ReprocessTarget = { ids: string[]; unknownCount: number }

export function AdminOutboxFailuresPage() {
  const { t, i18n } = useTranslation(NS)
  const { t: tCommon } = useTranslation('common')
  const locale = i18n.language

  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [reloadCounter, setReloadCounter] = useState(0)

  const [data, setData] = useState<ListOutboxFailuresResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)
  const [target, setTarget] = useState<ReprocessTarget | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [isReprocessing, setIsReprocessing] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setHasError(false)
      try {
        const result = await listOutboxFailures({
          page,
          limit: PAGE_SIZE,
          ...(filters.status !== 'all' && { status: filters.status }),
          ...(filters.origin !== 'all' && { origin: filters.origin }),
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

  const items = useMemo(() => data?.items ?? [], [data])
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  const isEmpty = !isLoading && !hasError && items.length === 0
  const allSelected =
    items.length > 0 && items.every(item => selected.has(item.id))

  function reload() {
    setReloadCounter(c => c + 1)
  }

  function applyFilters() {
    setFilters(draft)
    setPage(1)
    setSelected(new Set())
  }

  function toggle(id: string, checked: boolean) {
    setSelected(current => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(items.map(item => item.id)) : new Set())
  }

  function askReprocess(failures: Pick<OutboxFailure, 'id' | 'status'>[]) {
    setAcknowledged(false)
    setTarget({
      ids: failures.map(failure => failure.id),
      unknownCount: failures.filter(failure => failure.status === 'UNKNOWN')
        .length,
    })
  }

  async function confirmReprocess() {
    if (!target) return
    setIsReprocessing(true)
    try {
      if (target.ids.length === 1) {
        const status = await reprocessOutboxFailure(target.ids[0], acknowledged)
        if (status === 'requeued') toast.success(t(`result.${status}`))
        else toast.warning(t(`result.${status}`))
      } else {
        const summary = summarizeReprocess(
          await reprocessOutboxFailures(target.ids, acknowledged),
        )
        const refused = target.ids.length - summary.requeued
        const message = t('batchSummary', {
          requeued: summary.requeued,
          refused,
        })
        if (refused === 0) toast.success(message)
        else toast.warning(message)
      }
      setSelected(new Set())
      reload()
    } catch {
      toast.error(t('reprocessError'))
    } finally {
      setIsReprocessing(false)
      setTarget(null)
    }
  }

  const selectedFailures = items.filter(item => selected.has(item.id))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={reload} disabled={isLoading}>
            <RefreshCw className="size-4" />
            {t('refresh')}
          </Button>
          <Button
            onClick={() => askReprocess(selectedFailures)}
            disabled={selectedFailures.length === 0}
          >
            <RotateCcw className="size-4" />
            {t('reprocessSelected', { count: selectedFailures.length })}
          </Button>
        </div>
      </div>

      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={event => {
          event.preventDefault()
          applyFilters()
        }}
      >
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="failure-domain">{t('filterDomain')}</FieldLabel>
          <Input
            id="failure-domain"
            className="w-56"
            placeholder={t('filterDomainPlaceholder')}
            value={draft.domain}
            onChange={event =>
              setDraft(d => ({ ...d, domain: event.target.value }))
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="failure-status">{t('filterStatus')}</FieldLabel>
          <Select
            value={draft.status}
            onValueChange={(value: string | null) =>
              setDraft(d => ({
                ...d,
                status: (value ?? 'all') as Filters['status'],
              }))
            }
          >
            <SelectTrigger id="failure-status" className="w-40">
              <SelectValue>
                {(value: string) =>
                  value === 'all' ? t('filterAll') : t(`status.${value}`)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filterAll')}</SelectItem>
              <SelectItem value="FAILED">{t('status.FAILED')}</SelectItem>
              <SelectItem value="UNKNOWN">{t('status.UNKNOWN')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="failure-origin">{t('filterOrigin')}</FieldLabel>
          <Select
            value={draft.origin}
            onValueChange={(value: string | null) =>
              setDraft(d => ({
                ...d,
                origin: (value ?? 'all') as Filters['origin'],
              }))
            }
          >
            <SelectTrigger id="failure-origin" className="w-56">
              <SelectValue>
                {(value: string) =>
                  value === 'all' ? t('filterAll') : t(`origin.${value}`)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filterAll')}</SelectItem>
              {OUTBOX_ORIGINS.map(origin => (
                <SelectItem key={origin} value={origin}>
                  {t(`origin.${origin}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="failure-from">{t('filterFrom')}</FieldLabel>
          <Input
            id="failure-from"
            type="date"
            className="w-40"
            value={draft.from}
            onChange={event =>
              setDraft(d => ({ ...d, from: event.target.value }))
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="failure-to">{t('filterTo')}</FieldLabel>
          <Input
            id="failure-to"
            type="date"
            className="w-40"
            value={draft.to}
            onChange={event =>
              setDraft(d => ({ ...d, to: event.target.value }))
            }
          />
        </div>

        <Button type="submit" variant="outline">
          {t('applyFilters')}
        </Button>
      </form>

      {isLoading && !data ? (
        <p className="text-sm text-muted-foreground">{tCommon('carregando')}</p>
      ) : hasError ? (
        <div className="admin-card p-6">
          <h2 className="text-lg font-medium text-foreground">
            {t('errorTitle')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('errorDescription')}
          </p>
          <Button variant="outline" className="mt-4" onClick={reload}>
            {t('retry')}
          </Button>
        </div>
      ) : isEmpty ? (
        <div className="admin-card p-6">
          <h2 className="text-lg font-medium text-foreground">
            {t('emptyTitle')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('emptyDescription')}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-background">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      aria-label={t('table.selectAll')}
                      checked={allSelected}
                      onCheckedChange={(checked: boolean) => toggleAll(checked)}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('table.createdAt')}
                  </th>
                  <th className="px-4 py-3 font-medium">{t('table.domain')}</th>
                  <th className="px-4 py-3 font-medium">{t('table.line')}</th>
                  <th className="px-4 py-3 font-medium">{t('table.origin')}</th>
                  <th className="px-4 py-3 font-medium">{t('table.status')}</th>
                  <th className="px-4 py-3 font-medium">
                    {t('table.message')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('table.destination')}
                  </th>
                  <th className="px-4 py-3 font-medium">{t('table.error')}</th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t('table.reprocessed')}
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
                    <td
                      className="px-4 py-3"
                      onClick={event => event.stopPropagation()}
                    >
                      <Checkbox
                        aria-label={t('table.selectRow')}
                        checked={selected.has(item.id)}
                        onCheckedChange={(checked: boolean) =>
                          toggle(item.id, checked)
                        }
                      />
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap text-foreground">
                      {formatPortalDate(item.createdAt, locale)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.domainName ?? item.domainId}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {item.subscriptionItemId}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t(`origin.${item.origin}`)}
                    </td>
                    <td className="px-4 py-3">
                      <OutboxStatusBadge status={item.status} />
                    </td>
                    <td className="min-w-64 max-w-sm px-4 py-3 break-words text-foreground">
                      {item.text || item.fileName || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {item.destination}
                    </td>
                    <td className="min-w-64 max-w-sm px-4 py-3 break-words text-red-700 dark:text-red-400">
                      {item.lastError ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                      {item.reprocessCount > 0
                        ? t('reprocessedTimes', { count: item.reprocessCount })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t('page', { current: page, total: totalPages })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  {t('previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  {t('next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <AdminOutboxFailureDetail
        id={openId}
        reloadKey={reloadCounter}
        onClose={() => setOpenId(null)}
        onReprocess={failure => askReprocess([failure])}
      />

      <Dialog
        open={target !== null}
        onOpenChange={open => {
          if (!open && !isReprocessing) setTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('confirmTitle', { count: target?.ids.length ?? 0 })}
            </DialogTitle>
            <DialogDescription>{t('confirmDescription')}</DialogDescription>
          </DialogHeader>

          {target && target.unknownCount > 0 && (
            <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <p className="font-medium">{t('unknownWarningTitle')}</p>
              <p>{t('unknownWarning', { count: target.unknownCount })}</p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="acknowledge-duplicate"
                  checked={acknowledged}
                  onCheckedChange={(checked: boolean) =>
                    setAcknowledged(checked)
                  }
                />
                <FieldLabel htmlFor="acknowledge-duplicate">
                  {t('unknownAcknowledge')}
                </FieldLabel>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTarget(null)}
              disabled={isReprocessing}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={() => void confirmReprocess()}
              disabled={
                isReprocessing ||
                (target !== null && target.unknownCount > 0 && !acknowledged)
              }
            >
              {isReprocessing && <Loader2 className="size-4 animate-spin" />}
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
