'use client'

import { useEffect, useState } from 'react'
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
  getOutboxFailure,
  type OutboxFailureDetail,
} from '@/lib/outbox-failures'
import { OutboxStatusBadge } from './admin-outbox-status-badge'

type Props = {
  /** A falha aberta; `null` fecha o painel. */
  id: string | null
  /** Muda quando a lista recarrega, para o detalhe refletir um reprocessamento. */
  reloadKey: number
  onClose: () => void
  onReprocess: (failure: Pick<OutboxFailureDetail, 'id' | 'status'>) => void
}

export function AdminOutboxFailureDetail({
  id,
  reloadKey,
  onClose,
  onReprocess,
}: Props) {
  const { t, i18n } = useTranslation('admin/outbox-failures')
  const { t: tCommon } = useTranslation('common')
  const locale = i18n.language

  const [detail, setDetail] = useState<OutboxFailureDetail | null>(null)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    setHasError(false)
    getOutboxFailure(id)
      .then(result => {
        if (!cancelled) setDetail(result)
      })
      .catch(() => {
        if (!cancelled) setHasError(true)
      })

    return () => {
      cancelled = true
    }
  }, [id, reloadKey])

  const shown = detail && detail.id === id ? detail : null
  const canReprocess =
    shown !== null &&
    (shown.status === 'FAILED' || shown.status === 'UNKNOWN') &&
    shown.providerMessageId === null

  const rows: [string, React.ReactNode][] = shown
    ? [
        [t('detail.destination'), shown.destination],
        [t('detail.domain'), shown.domainName ?? shown.domainId],
        [t('detail.line'), shown.subscriptionItemId],
        [t('detail.app'), shown.appCode],
        [t('detail.origin'), t(`origin.${shown.origin}`)],
        ...(shown.bitrixChatId
          ? [
              [
                t('detail.openChannel'),
                t('detail.openChannelValue', {
                  chat: shown.bitrixChatId,
                  message: shown.bitrixMessageId ?? '—',
                }),
              ] as [string, React.ReactNode],
            ]
          : []),
        ...(shown.operatorBitrixUserId
          ? [
              [t('detail.operator'), shown.operatorBitrixUserId] as [
                string,
                React.ReactNode,
              ],
            ]
          : []),
        [t('detail.entity'), `${shown.entity} #${shown.entityId}`],
        [t('detail.attempts'), shown.attempts],
        [t('detail.createdAt'), formatPortalDate(shown.createdAt, locale)],
        [t('detail.updatedAt'), formatPortalDate(shown.updatedAt, locale)],
        ...(shown.sentAt
          ? [
              [t('detail.sentAt'), formatPortalDate(shown.sentAt, locale)] as [
                string,
                React.ReactNode,
              ],
            ]
          : []),
        ...(shown.providerMessageId
          ? [
              [t('detail.providerMessageId'), shown.providerMessageId] as [
                string,
                React.ReactNode,
              ],
            ]
          : []),
        [
          t('detail.reprocessHistory'),
          shown.reprocessCount > 0 && shown.lastReprocessedAt
            ? t('detail.reprocessHistoryValue', {
                count: shown.reprocessCount,
                date: formatPortalDate(shown.lastReprocessedAt, locale),
                user: shown.lastReprocessedByEmail ?? '—',
              })
            : t('detail.neverReprocessed'),
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
          <SheetTitle>{t('detailTitle')}</SheetTitle>
          {shown && (
            <SheetDescription className="flex items-center gap-2">
              <OutboxStatusBadge status={shown.status} />
              <span>{formatPortalDate(shown.createdAt, locale)}</span>
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          {hasError ? (
            <p className="text-sm text-muted-foreground">
              {t('detailLoadError')}
            </p>
          ) : !shown ? (
            <p className="text-sm text-muted-foreground">
              {tCommon('carregando')}
            </p>
          ) : (
            <>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {shown.templateName
                    ? `${t('detail.template')}: ${shown.templateName}`
                    : t('detail.text')}
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap break-words text-foreground">
                  {shown.text || '—'}
                </p>
                {shown.fileName && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('detail.file')}: {shown.fileName}
                    {shown.mediaType ? ` (${shown.mediaType})` : ''}
                  </p>
                )}
                {shown.caption && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('detail.caption')}: {shown.caption}
                  </p>
                )}
              </div>

              {shown.lastError && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  <p className="font-medium">{t('detail.error')}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words">
                    {shown.lastError}
                  </p>
                </div>
              )}

              <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,12rem)_1fr]">
                {rows.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="break-words text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>

              {canReprocess && (
                <Button onClick={() => onReprocess(shown)}>
                  <RotateCcw className="size-4" />
                  {t('reprocess')}
                </Button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
