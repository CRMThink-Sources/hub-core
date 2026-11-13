'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPortalDate } from '@/lib/format-date'
import {
  listInboundFailures,
  reprocessInboundFailure,
  type InboundFailure,
} from '@/lib/inbound-failures'
import {
  listOutboxFailures,
  reprocessOutboxFailure,
  type OutboxFailure,
} from '@/lib/outbox-failures'
import { AdminInboundFailureDetail } from './admin-inbound-failure-detail'
import { InboundStatusBadge } from './admin-inbound-status-badge'
import { AdminOutboxFailureDetail } from './admin-outbox-failure-detail'
import { OutboxStatusBadge } from './admin-outbox-status-badge'
import {
  AdminReprocessDialog,
  type ReprocessTarget,
} from './admin-reprocess-dialog'
import { AdminEmptyState } from './ui/admin-empty-state'
import { AdminPanel } from './ui/admin-panel'
import { AdminStatusBadge } from './ui/admin-status-badge'

/** Poucos itens: a seção é um resumo, a tela geral é o lugar de explorar. */
const SECTION_LIMIT = 5
const NS = 'admin/message-failures'

type Loaded = {
  outbox: OutboxFailure[]
  inbound: InboundFailure[]
  retentionDays: number
}

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; data: Loaded }

type Row =
  | { direction: 'outbox'; createdAt: string; item: OutboxFailure }
  | { direction: 'inbound'; createdAt: string; item: InboundFailure }

type OpenFailure = { direction: 'outbox' | 'inbound'; id: string } | null

/**
 * Falhas de mensagens do cliente (envio e recebimento), filtradas pelo **portal exato**
 * (`domainId`) — `acme` não traz `acme-filial`. Falhar ao carregar não derruba a página:
 * a seção mostra "indisponível" com a opção de tentar de novo.
 */
export function AdminClientFailuresSection({
  domainId,
  domainName,
}: {
  domainId: string
  domainName: string
}) {
  const { t, i18n } = useTranslation(NS)
  const { t: tOutbox } = useTranslation('admin/outbox-failures')
  const locale = i18n.language

  const [state, setState] = useState<State>({ kind: 'loading' })
  const [reloadCounter, setReloadCounter] = useState(0)
  const [open, setOpen] = useState<OpenFailure>(null)
  const [target, setTarget] = useState<
    (ReprocessTarget & { direction: 'outbox' | 'inbound' }) | null
  >(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [isReprocessing, setIsReprocessing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })

    Promise.all([
      listOutboxFailures({ page: 1, limit: SECTION_LIMIT, domainId }),
      listInboundFailures({ page: 1, limit: SECTION_LIMIT, domainId }),
    ])
      .then(([outbox, inbound]) => {
        if (cancelled) return
        setState({
          kind: 'ready',
          data: {
            outbox: outbox.items,
            inbound: inbound.items,
            retentionDays: outbox.retentionDays,
          },
        })
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [domainId, reloadCounter])

  const reload = useCallback(() => setReloadCounter(c => c + 1), [])

  const rows = useMemo<Row[]>(() => {
    if (state.kind !== 'ready') return []
    const outbox = state.data.outbox.map(
      (item): Row => ({ direction: 'outbox', createdAt: item.createdAt, item }),
    )
    const inbound = state.data.inbound.map(
      (item): Row => ({
        direction: 'inbound',
        createdAt: item.createdAt,
        item,
      }),
    )
    return [...outbox, ...inbound]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, SECTION_LIMIT * 2)
  }, [state])

  async function confirmReprocess() {
    if (!target) return
    setIsReprocessing(true)
    try {
      const id = target.ids[0]
      const status =
        target.direction === 'outbox'
          ? await reprocessOutboxFailure(id, acknowledged)
          : await reprocessInboundFailure(id)

      const message =
        target.direction === 'outbox'
          ? tOutbox(`result.${status}`)
          : t(`inbound.result.${status}`)
      if (status === 'requeued') toast.success(message)
      else toast.warning(message)
      reload()
    } catch {
      toast.error(
        target.direction === 'outbox'
          ? tOutbox('reprocessError')
          : t('inbound.reprocessError'),
      )
    } finally {
      setIsReprocessing(false)
      setTarget(null)
    }
  }

  const days = state.kind === 'ready' ? state.data.retentionDays : null

  return (
    <AdminPanel
      title={t('client.title')}
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={reload}
            disabled={state.kind === 'loading'}
          >
            <RefreshCw className="size-3.5" />
            {t('client.refresh')}
          </Button>
          <Link
            href={`/admin/falhas-envio?domain=${encodeURIComponent(domainName)}`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {t('client.openAll')}
          </Link>
        </div>
      }
      bodyClassName="space-y-3 px-5 pb-5 pt-3"
    >
      {days !== null && (
        <p className="text-sm text-muted-foreground">
          {t('client.description', { days })}
        </p>
      )}

      {state.kind === 'loading' ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : state.kind === 'error' ? (
        <AdminEmptyState
          icon={AlertTriangle}
          title={t('client.unavailable')}
          description={t('client.unavailableDescription')}
          action={
            <Button variant="outline" size="sm" onClick={reload}>
              {t('client.retry')}
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <AdminEmptyState title={t('client.empty', { days })} />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map(row => (
            <li key={`${row.direction}-${row.item.id}`}>
              <button
                type="button"
                aria-label={t('client.openDetail')}
                onClick={() =>
                  setOpen({ direction: row.direction, id: row.item.id })
                }
                className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <AdminStatusBadge tone="neutral">
                    {t(`client.direction.${row.direction}`)}
                  </AdminStatusBadge>
                  {row.direction === 'outbox' ? (
                    <OutboxStatusBadge status={row.item.status} />
                  ) : (
                    <InboundStatusBadge status={row.item.status} />
                  )}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatPortalDate(row.createdAt, locale)}
                  </span>
                </span>
                <span className="line-clamp-2 break-words text-sm text-red-700 dark:text-red-400">
                  {row.direction === 'outbox'
                    ? (row.item.lastError ?? '—')
                    : row.item.errorMessage}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AdminOutboxFailureDetail
        id={open?.direction === 'outbox' ? open.id : null}
        reloadKey={reloadCounter}
        onClose={() => setOpen(null)}
        onReprocess={failure => {
          setAcknowledged(false)
          setTarget({
            direction: 'outbox',
            ids: [failure.id],
            unknownCount: failure.status === 'UNKNOWN' ? 1 : 0,
          })
        }}
      />
      <AdminInboundFailureDetail
        id={open?.direction === 'inbound' ? open.id : null}
        reloadKey={reloadCounter}
        onClose={() => setOpen(null)}
        onReprocess={failure =>
          setTarget({
            direction: 'inbound',
            ids: [failure.id],
            unknownCount: 0,
          })
        }
      />

      <AdminReprocessDialog
        target={target}
        title={
          target?.direction === 'inbound'
            ? t('inbound.confirmTitle')
            : tOutbox('confirmTitle', { count: 1 })
        }
        description={
          target?.direction === 'inbound'
            ? t('inbound.confirmDescription')
            : tOutbox('confirmDescription')
        }
        isReprocessing={isReprocessing}
        acknowledged={acknowledged}
        onAcknowledgedChange={setAcknowledged}
        onConfirm={() => void confirmReprocess()}
        onCancel={() => setTarget(null)}
      />
    </AdminPanel>
  )
}
