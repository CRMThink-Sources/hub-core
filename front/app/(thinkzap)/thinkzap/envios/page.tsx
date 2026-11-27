'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { InfoIcon, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useThinkzapAccessState } from '@/providers/thinkzap-access-provider'
import {
  resolveThinkzapClient,
  type ThinkzapHttpClient,
} from '../_lib/thinkzap-client'
import {
  readSendFilters,
  toApiQuery,
  writeSendFilters,
  type SendFilters,
} from '../_lib/send-filters'
import { listSends, type SendListResponse } from '../_lib/thinkzap-sends-client'
import { mergeSendFiltersIntoSearch } from '../_components/envios/envios-view'
import {
  SendsEmpty,
  SendsError,
  SendsLoading,
  SendsSessionExpired,
} from '../_components/envios/envios-states'
import { SendFilterBar } from '../_components/envios/send-filter-bar'
import { SendsTable } from '../_components/envios/sends-table'
import { SendsPagination } from '../_components/envios/sends-pagination'
import { SendDetailSheet } from '../_components/envios/send-detail-sheet'
import { resolvePortalHost } from '../_components/envios/portal-host'

/** Prazo do histórico até a primeira resposta da API (que traz o valor real). */
const DEFAULT_RETENTION_DAYS = 90

type ClientState =
  | { status: 'loading' }
  | { status: 'ready'; client: ThinkzapHttpClient }
  | { status: 'unauthenticated' }

type ListState =
  | { status: 'loading'; data: SendListResponse | null }
  | { status: 'ready'; data: SendListResponse }
  | { status: 'error' }

/**
 * Aba Envios: envios do widget e dos robôs, uma linha por destinatário.
 * Os filtros e a página vivem na query string (link compartilhável e o
 * "voltar" do navegador desfaz o último filtro); `useSearchParams` exige o
 * `Suspense` abaixo. Quem vê o quê é decidido na API, pelo token: aqui o
 * papel só esconde o filtro de remetente, que a API ignoraria.
 */
export default function ThinkzapEnviosPage() {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Suspense fallback={<SendsLoading />}>
        <EnviosContent />
      </Suspense>
    </div>
  )
}

function EnviosContent() {
  const { t, i18n } = useTranslation('thinkzap/envios')
  const locale = i18n.language
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { state: accessState } = useThinkzapAccessState()
  const isAdmin =
    accessState.status === 'ready' && accessState.access.canManageAccess

  // O token vive em sessionStorage (só no cliente): resolver no render daria
  // diferença de hidratação, como na tela de logs.
  const [clientState, setClientState] = useState<ClientState>({
    status: 'loading',
  })
  const [portalHost, setPortalHost] = useState<string | null>(null)
  useEffect(() => {
    const resolved = resolveThinkzapClient()
    setClientState(
      resolved.ok
        ? { status: 'ready', client: resolved.client }
        : { status: 'unauthenticated' },
    )
    setPortalHost(resolvePortalHost())
  }, [])

  const filters = useMemo(() => readSendFilters(searchParams), [searchParams])
  // Chave estável dos filtros: o objeto muda a cada leitura da URL.
  const filtersKey = writeSendFilters(filters)

  const [list, setList] = useState<ListState>({
    status: 'loading',
    data: null,
  })
  const [attempt, setAttempt] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  const client = clientState.status === 'ready' ? clientState.client : null

  useEffect(() => {
    if (!client) return
    let cancelled = false
    setList(current => ({
      status: 'loading',
      data: current.status === 'error' ? null : current.data,
    }))
    // Datas sempre por `toApiQuery`: início e fim do dia LOCAL como instante.
    listSends(client, toApiQuery(readSendFilters(searchParams), new Date()))
      .then(data => {
        if (!cancelled) setList({ status: 'ready', data })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          setClientState({ status: 'unauthenticated' })
          return
        }
        setList({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
    // `searchParams` entra pela chave: outros parâmetros da URL não refazem a consulta.
  }, [client, filtersKey, attempt])

  const changeFilters = useCallback(
    (next: SendFilters) => {
      const search = mergeSendFiltersIntoSearch(window.location.search, next)
      // `push`: cada filtro vira um passo do histórico, para o "voltar" desfazer.
      router.push(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      })
    },
    [router, pathname],
  )

  if (clientState.status === 'loading') return <SendsLoading />
  if (clientState.status === 'unauthenticated' || !client) {
    return <SendsSessionExpired />
  }

  const data = list.status === 'error' ? null : list.data
  const retentionDays = data?.retentionDays ?? DEFAULT_RETENTION_DAYS
  const isLoading = list.status === 'loading'

  return (
    <>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setAttempt(n => n + 1)}
          disabled={isLoading}
        >
          <RefreshCw
            className={isLoading ? 'size-4 animate-spin' : 'size-4'}
            aria-hidden
          />
          {t('refresh')}
        </Button>
      </header>

      <aside className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <p className="flex items-start gap-1.5">
          <InfoIcon className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>{t('notices.retention', { retentionDays })}</span>
        </p>
        <p className="pl-5">{t('notices.zapi')}</p>
      </aside>

      <SendFilterBar
        filters={filters}
        onChange={changeFilters}
        lines={data?.lines ?? []}
        senders={data?.senders ?? []}
        showSenderFilter={isAdmin}
        retentionDays={retentionDays}
      />

      <section aria-busy={isLoading} className="flex flex-col gap-4">
        {list.status === 'error' ? (
          <SendsError onRetry={() => setAttempt(n => n + 1)} />
        ) : !data ? (
          <SendsLoading />
        ) : data.items.length === 0 ? (
          <>
            <SendsEmpty />
            {filters.page > 1 && data.total > 0 && (
              <SendsPagination
                page={filters.page}
                total={data.total}
                limit={data.limit}
                locale={locale}
                disabled={isLoading}
                onPageChange={page => changeFilters({ ...filters, page })}
              />
            )}
          </>
        ) : (
          <>
            <div
              className={
                isLoading
                  ? 'opacity-60 transition-opacity'
                  : 'transition-opacity'
              }
            >
              <SendsTable
                items={data.items}
                locale={locale}
                onOpen={setOpenId}
              />
            </div>
            <SendsPagination
              page={filters.page}
              total={data.total}
              limit={data.limit}
              locale={locale}
              disabled={isLoading}
              onPageChange={page => changeFilters({ ...filters, page })}
            />
          </>
        )}
      </section>

      <SendDetailSheet
        id={openId}
        client={client}
        locale={locale}
        portalHost={portalHost}
        onClose={() => setOpenId(null)}
      />
    </>
  )
}
