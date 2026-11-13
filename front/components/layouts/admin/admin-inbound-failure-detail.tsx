'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatPortalDate } from '@/lib/format-date'
import {
  getInboundFailure,
  type InboundFailureDetail,
} from '@/lib/inbound-failures'
import { AdminDeliveryAttempts } from './admin-delivery-attempts'
import { InboundStatusBadge } from './admin-inbound-status-badge'

type Props = {
  /** A falha aberta; `null` fecha o painel. */
  id: string | null
  /** Muda quando a lista recarrega, para o detalhe refletir um reprocessamento. */
  reloadKey: number
  onClose: () => void
  onReprocess: (failure: Pick<InboundFailureDetail, 'id'>) => void
}

export function AdminInboundFailureDetail({
  id,
  reloadKey,
  onClose,
  onReprocess,
}: Props) {
  const { t, i18n } = useTranslation('admin/message-failures')
  const { t: tCommon } = useTranslation('common')
  const locale = i18n.language

  const [detail, setDetail] = useState<InboundFailureDetail | null>(null)
  const [error, setError] = useState<'none' | 'not-found' | 'load'>('none')

  useEffect(() => {
    if (!id) return
    let cancelled = false

    setError('none')
    getInboundFailure(id)
      .then(result => {
        if (!cancelled) setDetail(result)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // Expirada pelo prazo de guarda: a tela explica, em vez de um erro genérico.
        setError(
          axios.isAxiosError(err) && err.response?.status === 404
            ? 'not-found'
            : 'load',
        )
      })

    return () => {
      cancelled = true
    }
  }, [id, reloadKey])

  const shown = detail && detail.id === id ? detail : null

  const rows: [string, React.ReactNode][] = shown
    ? [
        [t('inbound.detail.source'), t(`inbound.source.${shown.source}`)],
        [t('inbound.detail.type'), shown.type || '—'],
        [t('inbound.detail.domain'), shown.domainName ?? shown.domainId ?? '—'],
        ...(shown.instanceId
          ? ([[t('inbound.detail.instance'), shown.instanceId]] as [
              string,
              React.ReactNode,
            ][])
          : []),
        [
          t('inbound.detail.traceKey'),
          shown.traceKey ? (
            <span className="font-mono text-xs break-all">
              {shown.traceKey}
            </span>
          ) : (
            '—'
          ),
        ],
        [
          t('inbound.detail.errorCode'),
          <span key="code" className="font-mono text-xs">
            {shown.errorCode}
          </span>,
        ],
        [t('inbound.detail.attempts'), shown.attempts],
        [
          t('inbound.detail.createdAt'),
          formatPortalDate(shown.createdAt, locale),
        ],
        ...Object.entries(shown.payloadFields).map(
          ([key, value]) =>
            [
              `${t('inbound.detail.fields')} · ${key}`,
              <span key={key} className="font-mono text-xs break-all">
                {value}
              </span>,
            ] as [string, React.ReactNode],
        ),
        ...(shown.previousFailureId
          ? ([
              [
                t('inbound.detail.previousFailure'),
                <span key="prev" className="font-mono text-xs break-all">
                  {shown.previousFailureId}
                </span>,
              ],
            ] as [string, React.ReactNode][])
          : []),
        [
          t('inbound.detail.reprocessHistory'),
          shown.reprocessCount > 0 && shown.lastReprocessedAt
            ? t('inbound.detail.reprocessHistoryValue', {
                count: shown.reprocessCount,
                date: formatPortalDate(shown.lastReprocessedAt, locale),
                user: shown.lastReprocessedByEmail ?? '—',
              })
            : t('inbound.detail.neverReprocessed'),
        ],
      ]
    : []

  return (
    <Sheet
      open={id !== null}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{t('inbound.detailTitle')}</SheetTitle>
          {shown && (
            <SheetDescription className="flex items-center gap-2">
              <InboundStatusBadge status={shown.status} />
              <span>{formatPortalDate(shown.createdAt, locale)}</span>
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          {error !== 'none' ? (
            <p className="text-sm text-muted-foreground">
              {error === 'not-found'
                ? t('inbound.detailNotFound')
                : t('inbound.detailLoadError')}
            </p>
          ) : !shown ? (
            <p className="text-sm text-muted-foreground">
              {tCommon('carregando')}
            </p>
          ) : (
            <>
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                <p className="font-medium">{t('inbound.detail.error')}</p>
                <p className="mt-1 whitespace-pre-wrap break-words">
                  {shown.errorMessage}
                </p>
              </div>

              <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,12rem)_1fr]">
                {rows.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="break-words text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>

              <AdminDeliveryAttempts attempts={shown.attemptLog} />

              {shown.reprocessable ? (
                <Button onClick={() => onReprocess(shown)}>
                  <RotateCcw className="size-4" />
                  {t('inbound.reprocess')}
                </Button>
              ) : (
                shown.status === 'FAILED' && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {t('inbound.notReprocessable')}.
                    </span>{' '}
                    {t('inbound.notReprocessableHint')}
                  </p>
                )
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
