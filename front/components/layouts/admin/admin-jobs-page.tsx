'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Info, Loader2, Play, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldLabel } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
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
import {
  getExpirationRun,
  listExpirationRuns,
  startExpirationRun,
  type ExpirationRun,
  type ExpirationRunTrigger,
  type ListExpirationRunsResponse,
} from '@/lib/subscription-expiration-runs'
import { AdminExpirationRunsTable } from './admin-expiration-runs-table'
import { AdminExpirationRunDetail } from './admin-expiration-run-detail'

const PAGE_SIZE = 20
/** Intervalo entre consultas enquanto a rodada disparada aqui está em andamento. */
const POLL_INTERVAL_MS = 3000
/** Teto do acompanhamento: a rodada que passa disso aparece como abandonada. */
const POLL_MAX_ATTEMPTS = 200

type TriggerFilter = 'all' | ExpirationRunTrigger

export function AdminJobsPage() {
  const { t } = useTranslation('admin/jobs')
  const { t: tCommon } = useTranslation('common')

  const [data, setData] = useState<ListExpirationRunsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [page, setPage] = useState(1)
  const [onlyWithChanges, setOnlyWithChanges] = useState(false)
  const [trigger, setTrigger] = useState<TriggerFilter>('all')
  const [reloadCounter, setReloadCounter] = useState(0)

  const [openRun, setOpenRun] = useState<ExpirationRun | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  /** A rodada manual disparada nesta tela, acompanhada até terminar. */
  const [watchedRunId, setWatchedRunId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setHasError(false)

      try {
        const result = await listExpirationRuns({
          page,
          limit: PAGE_SIZE,
          ...(trigger !== 'all' && { trigger }),
          onlyWithChanges,
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
  }, [page, trigger, onlyWithChanges, reloadCounter])

  /**
   * Acompanha a rodada disparada aqui pelo detalhe dela — não pela lista, que pode
   * estar filtrada de um jeito que a esconda — e recarrega a lista a cada consulta.
   */
  useEffect(() => {
    if (!watchedRunId) return
    let cancelled = false
    let attempts = 0
    let timer: ReturnType<typeof setTimeout>

    async function poll() {
      attempts++
      try {
        const run = await getExpirationRun(watchedRunId as string)
        if (cancelled) return
        setReloadCounter(c => c + 1)
        if (run.status !== 'running' || attempts >= POLL_MAX_ATTEMPTS) {
          setWatchedRunId(null)
          return
        }
      } catch {
        if (cancelled) return
        if (attempts >= POLL_MAX_ATTEMPTS) {
          setWatchedRunId(null)
          return
        }
      }
      timer = setTimeout(() => void poll(), POLL_INTERVAL_MS)
    }

    timer = setTimeout(() => void poll(), POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [watchedRunId])

  function reload() {
    setReloadCounter(c => c + 1)
  }

  async function handleConfirmRun() {
    setIsStarting(true)
    try {
      const result = await startExpirationRun()

      if (result.status === 'started') {
        toast.success(t('startedToast'))
        setWatchedRunId(result.runId)
        setPage(1)
        reload()
      } else if (result.status === 'busy') {
        toast.warning(t('busyToast'))
      } else {
        toast.warning(t('disabledToast'))
      }
    } catch {
      toast.error(t('startErrorToast'))
    } finally {
      setIsStarting(false)
      setConfirmOpen(false)
    }
  }

  const meta = data?.meta
  const runs = data?.runs ?? []
  const isEmpty = !isLoading && !hasError && runs.length === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="mt-2 text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={reload} disabled={isLoading}>
            <RefreshCw className="size-4" />
            {t('refresh')}
          </Button>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={isStarting || watchedRunId !== null}
          >
            {watchedRunId ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {t('runNow')}
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>{t('notCancelNotice')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <Switch
            id="only-with-changes"
            checked={onlyWithChanges}
            onCheckedChange={(checked: boolean) => {
              setOnlyWithChanges(checked)
              setPage(1)
            }}
          />
          <FieldLabel htmlFor="only-with-changes">
            {t('filterOnlyWithChanges')}
          </FieldLabel>
        </div>

        <div className="flex items-center gap-3">
          <FieldLabel htmlFor="trigger-filter">{t('filterTrigger')}</FieldLabel>
          <Select
            value={trigger}
            onValueChange={(value: string | null) => {
              setTrigger((value ?? 'all') as TriggerFilter)
              setPage(1)
            }}
          >
            <SelectTrigger id="trigger-filter" className="w-40">
              <SelectValue>
                {(value: string) =>
                  value === 'all'
                    ? t('filterAllTriggers')
                    : t(`trigger.${value}`)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filterAllTriggers')}</SelectItem>
              <SelectItem value="scheduled">
                {t('trigger.scheduled')}
              </SelectItem>
              <SelectItem value="manual">{t('trigger.manual')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

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
          <AdminExpirationRunsTable runs={runs} onOpen={setOpenRun} />

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t('page', { current: meta.page, total: meta.totalPages })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  {t('previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  {t('next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <AdminExpirationRunDetail
        run={openRun}
        onClose={() => setOpenRun(null)}
      />

      <Dialog
        open={confirmOpen}
        onOpenChange={open => {
          if (!open && !isStarting) setConfirmOpen(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmTitle')}</DialogTitle>
            <DialogDescription>{t('confirmDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isStarting}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={() => void handleConfirmRun()}
              disabled={isStarting}
            >
              {isStarting && <Loader2 className="size-4 animate-spin" />}
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
