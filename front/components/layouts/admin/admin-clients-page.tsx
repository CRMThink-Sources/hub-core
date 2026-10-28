'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Building2, RotateCw, Search, X } from 'lucide-react'
import { axiosPortal } from '@/infra/client/axios-portal'
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
  EMPTY_CLIENTS_FILTER,
  availableAppCodes,
  filterClients,
  isFilterActive,
  paginate,
  type ClientsFilter,
  type ClientsPage,
} from '@/lib/admin-clients-filter'
import type {
  ListPortalDomainsResponse,
  PortalDomainDetail,
} from '@/lib/portal-domains'
import { AdminClientsTable } from './admin-clients-table'
import { AdminEmptyState } from './ui/admin-empty-state'
import { AdminPageHeader } from './ui/admin-page-header'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; domains: PortalDomainDetail[] }

const ALL_APPS = 'all'

export function AdminClientsPage() {
  const { t, i18n } = useTranslation('admin/clients')
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [filter, setFilter] = useState<ClientsFilter>(EMPTY_CLIENTS_FILTER)
  const [page, setPage] = useState(1)

  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    setState({ kind: 'loading' })
    try {
      const result =
        await axiosPortal().get<ListPortalDomainsResponse>('/portal/domains')
      if (!isCancelled()) setState({ kind: 'ready', domains: result.domains })
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

  const domains = useMemo(
    () => (state.kind === 'ready' ? state.domains : []),
    [state],
  )
  const appCodes = useMemo(() => availableAppCodes(domains), [domains])
  const filtered = useMemo(
    () => filterClients(domains, filter),
    [domains, filter],
  )
  const current = paginate(filtered, page)

  /** Mudar o filtro volta para a primeira página: a página 3 de outro recorte não existe. */
  const updateFilter = (patch: Partial<ClientsFilter>) => {
    setFilter(previous => ({ ...previous, ...patch }))
    setPage(1)
  }

  const clearFilters = () => {
    setFilter(EMPTY_CLIENTS_FILTER)
    setPage(1)
  }

  const total = state.kind === 'ready' ? domains.length : null

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
      />

      {state.kind === 'error' ? (
        <AdminEmptyState
          icon={AlertTriangle}
          title={t('errorTitle')}
          description={t('errorDescription')}
          action={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RotateCw className="size-3.5" />
              {t('retry')}
            </Button>
          }
        />
      ) : state.kind === 'ready' && domains.length === 0 ? (
        <AdminEmptyState
          icon={Building2}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <>
          <form
            role="search"
            aria-label={t('filters.label')}
            className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
            onSubmit={event => event.preventDefault()}
          >
            <div className="flex flex-col gap-1.5 sm:w-72">
              <FieldLabel htmlFor="clients-search">
                {t('filters.search')}
              </FieldLabel>
              <div className="relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="clients-search"
                  type="search"
                  className="pl-8"
                  placeholder={t('filters.searchPlaceholder')}
                  value={filter.search}
                  onChange={event =>
                    updateFilter({ search: event.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="clients-app">{t('filters.app')}</FieldLabel>
              <Select
                value={filter.appCodeId || ALL_APPS}
                onValueChange={(value: string | null) =>
                  updateFilter({
                    appCodeId: !value || value === ALL_APPS ? '' : value,
                  })
                }
              >
                <SelectTrigger id="clients-app" className="w-full sm:w-56">
                  <SelectValue>
                    {(value: string) =>
                      value === ALL_APPS
                        ? t('filters.allApps')
                        : (appCodes.find(code => code.id === value)?.name ??
                          value)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_APPS}>
                    {t('filters.allApps')}
                  </SelectItem>
                  {appCodes.map(code => (
                    <SelectItem key={code.id} value={code.id}>
                      {code.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-h-9 items-center gap-2">
              <Checkbox
                id="clients-pending-mirror"
                checked={filter.pendingMirror}
                onCheckedChange={(checked: boolean) =>
                  updateFilter({ pendingMirror: checked })
                }
              />
              <FieldLabel htmlFor="clients-pending-mirror">
                {t('filters.pendingMirror')}
              </FieldLabel>
            </div>

            {isFilterActive(filter) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start sm:self-auto"
                onClick={clearFilters}
              >
                <X className="size-3.5" />
                {t('filters.clear')}
              </Button>
            )}
          </form>

          <ClientsListBody
            loading={state.kind === 'loading'}
            page={current}
            filteredTotal={filtered.length}
            onClearFilters={clearFilters}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}

/**
 * O que fica abaixo dos filtros: carregando, nenhum resultado, ou a tabela com a
 * paginação. Só props, sem estado — é o pedaço da tela que muda com o filtro.
 */
export function ClientsListBody({
  loading,
  page,
  filteredTotal,
  onClearFilters,
  onPageChange,
}: {
  loading: boolean
  page: ClientsPage
  filteredTotal: number
  onClearFilters: () => void
  onPageChange: (page: number) => void
}) {
  const { t } = useTranslation('admin/clients')

  if (loading) return <ClientsTableSkeleton />

  if (filteredTotal === 0) {
    return (
      <AdminEmptyState
        icon={Search}
        title={t('noResultsTitle')}
        description={t('noResultsDescription')}
        action={
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            {t('filters.clear')}
          </Button>
        }
      />
    )
  }

  return (
    <>
      <AdminClientsTable domains={page.items} />

      <nav
        aria-label={t('table.label')}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <p className="text-sm text-muted-foreground tabular-nums">
          {t('pagination.range', {
            from: page.from,
            to: page.to,
            total: filteredTotal,
          })}
        </p>
        {page.pageCount > 1 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page.page <= 1}
              onClick={() => onPageChange(page.page - 1)}
            >
              {t('pagination.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page.page >= page.pageCount}
              onClick={() => onPageChange(page.page + 1)}
            >
              {t('pagination.next')}
            </Button>
          </div>
        )}
      </nav>
    </>
  )
}

/** Mesmo frame da tabela pronta, para a tela não pular quando os dados chegam. */
export function ClientsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      aria-busy
      className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="h-10" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-6 px-5 py-4">
          <span className="h-4 w-48 rounded bg-muted" />
          <span className="hidden h-3 w-24 rounded bg-muted md:block" />
          <span className="h-5 w-28 rounded-md bg-muted" />
          <span className="ml-auto hidden h-3 w-20 rounded bg-muted md:block" />
        </div>
      ))}
    </div>
  )
}
