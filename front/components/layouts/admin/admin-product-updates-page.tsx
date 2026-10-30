'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  ClipboardCheck,
  Megaphone,
  Plus,
  RotateCw,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  countProductUpdatesBySituation,
  filterProductUpdates,
  listProductUpdates,
  type ProductUpdateListItem,
  type ProductUpdatesFilter,
} from '@/lib/portal-product-updates'
import { STATUS_NAMESPACE } from '@/lib/portal-status'
import { AdminProductUpdatesTable } from './admin-product-updates-table'
import { AdminEmptyState } from './ui/admin-empty-state'
import { AdminPageHeader } from './ui/admin-page-header'

const NAMESPACE = 'admin/product-updates'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; items: ProductUpdateListItem[] }

/** "Aguardando revisão" vem logo depois de "Todas": é a fila do time. */
const FILTERS: ProductUpdatesFilter[] = [
  'all',
  'awaiting-review',
  'draft',
  'soon',
  'available',
]

/**
 * Lista de novidades do ThinkZap. Pergunta da tela: "o que precisa da minha
 * revisão?" — a contagem de "Aguardando revisão" abre a tela, com o atalho para o
 * recorte. O filtro é local: a api devolve a lista inteira (sem paginação).
 */
export function AdminProductUpdatesPage() {
  const { t, i18n } = useTranslation(NAMESPACE)
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [filter, setFilter] = useState<ProductUpdatesFilter>('all')

  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    setState({ kind: 'loading' })
    try {
      const result = await listProductUpdates()
      if (!isCancelled()) setState({ kind: 'ready', items: result.items })
    } catch {
      if (!isCancelled()) setState({ kind: 'error' })
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  const items = useMemo(
    () => (state.kind === 'ready' ? state.items : []),
    [state],
  )
  const counts = useMemo(() => countProductUpdatesBySituation(items), [items])
  const filtered = useMemo(
    () => filterProductUpdates(items, filter),
    [items, filter],
  )
  const total = state.kind === 'ready' ? items.length : null

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={
          <span className="inline-flex items-baseline gap-2">
            {t('title')}
            {total !== null && (
              <span className="text-base font-normal text-muted-foreground tabular-nums">
                {total.toLocaleString(i18n.language)}
              </span>
            )}
          </span>
        }
        description={t('description')}
        actions={
          <Link
            href="/admin/novidades/nova"
            className={buttonVariants({ size: 'default' })}
          >
            <Plus aria-hidden className="size-4" />
            {t('new')}
          </Link>
        }
      />

      {state.kind === 'error' ? (
        <AdminEmptyState
          icon={AlertTriangle}
          title={t('errorTitle')}
          description={t('errorDescription')}
          action={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RotateCw aria-hidden className="size-3.5" />
              {t('retry')}
            </Button>
          }
        />
      ) : state.kind === 'ready' && items.length === 0 ? (
        <AdminEmptyState
          icon={Megaphone}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={
            <Link
              href="/admin/novidades/nova"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Plus aria-hidden className="size-3.5" />
              {t('new')}
            </Link>
          }
        />
      ) : (
        <>
          {counts['awaiting-review'] > 0 && filter !== 'awaiting-review' && (
            <p
              role="status"
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-status-warning-soft px-3 py-2 text-sm text-status-warning-ink"
            >
              <ClipboardCheck aria-hidden className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                {t('awaitingReview', { count: counts['awaiting-review'] })}
              </span>
              <button
                type="button"
                onClick={() => setFilter('awaiting-review')}
                className="rounded-sm font-medium underline underline-offset-4 hover:no-underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {t('reviewNow')}
              </button>
            </p>
          )}

          <Tabs
            value={filter}
            onValueChange={value => setFilter(value as ProductUpdatesFilter)}
          >
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <TabsList
                variant="line"
                aria-label={t('filters.label')}
                className="border-b border-border"
              >
                {FILTERS.map(value => (
                  <TabsTrigger key={value} value={value} className="flex-none">
                    <FilterLabel filter={value} />
                    {state.kind === 'ready' && (
                      <span className="text-xs font-normal text-muted-foreground tabular-nums">
                        {counts[value].toLocaleString(i18n.language)}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value={filter} className="mt-4">
              {state.kind === 'loading' ? (
                <ProductUpdatesTableSkeleton />
              ) : filtered.length === 0 ? (
                <AdminEmptyState
                  title={t('noResultsTitle')}
                  description={t('noResultsDescription')}
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilter('all')}
                    >
                      {t('showAll')}
                    </Button>
                  }
                />
              ) : (
                <AdminProductUpdatesTable items={filtered} />
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

function FilterLabel({ filter }: { filter: ProductUpdatesFilter }) {
  const { t } = useTranslation(NAMESPACE)
  const { t: tStatus } = useTranslation(STATUS_NAMESPACE)
  return (
    <>
      {filter === 'all' ? t('filters.all') : tStatus(`productUpdate.${filter}`)}
    </>
  )
}

/** Mesmo frame da tabela pronta, para a tela não pular quando os dados chegam. */
export function ProductUpdatesTableSkeleton({ rows = 6 }: { rows?: number }) {
  const { t } = useTranslation(NAMESPACE)
  return (
    <div
      aria-busy
      className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card"
    >
      <p className="sr-only">{t('loading')}</p>
      <div className="hidden h-10 md:block" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-6 px-5 py-4">
          <span className="h-4 w-56 rounded bg-muted" />
          <span className="h-6 w-24 rounded-full bg-muted" />
          <span className="hidden h-3 w-28 rounded bg-muted md:block" />
          <span className="ml-auto hidden h-3 w-20 rounded bg-muted md:block" />
        </div>
      ))}
    </div>
  )
}
