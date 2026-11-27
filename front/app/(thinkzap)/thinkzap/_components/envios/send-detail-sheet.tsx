'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatPortalDate } from '@/lib/format-date'
import type { ThinkzapHttpClient } from '../../_lib/thinkzap-client'
import { capitalizeFirst, crmRecordHref } from '../../_lib/send-format'
import {
  getSendDetail,
  type SendDetail,
} from '../../_lib/thinkzap-sends-client'
import {
  crmEntityKey,
  isUnauthorizedError,
  presentTimestamps,
} from './envios-view'
import { SendStatusBadge } from './send-status-badge'
import { SenderLabel, UnconfirmedWarning } from './sends-table'

type DetailState =
  | { status: 'loading'; id: string }
  | { status: 'found'; id: string; detail: SendDetail }
  | { status: 'not-found'; id: string }
  | { status: 'error'; id: string }
  | { status: 'unauthorized'; id: string }

type Props = {
  /** Envio aberto; `null` fecha o painel. */
  id: string | null
  client: ThinkzapHttpClient
  locale: string
  /** Domínio do portal para o link do CRM (`null` = só texto). */
  portalHost: string | null
  onClose: () => void
}

/**
 * Painel lateral com o envio inteiro. Busca pelo id a cada abertura: o estado
 * de entrega muda depois do envio, e a lista pode estar alguns minutos atrás.
 * O texto da mensagem é dado do cliente: só é mostrado como texto (sem HTML)
 * e nunca vai para log.
 */
export function SendDetailSheet({
  id,
  client,
  locale,
  portalHost,
  onClose,
}: Props) {
  const { t } = useTranslation('thinkzap/envios')
  const [state, setState] = useState<DetailState | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Ao fechar, `id` vira `null` mas o painel ainda anima a saída: mantém o último
  // envio para o corpo não piscar "Carregando"; só some quando outro abre.
  const [lastId, setLastId] = useState<string | null>(id)
  if (id !== null && id !== lastId) setLastId(id)
  const displayId = id ?? lastId

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setState({ status: 'loading', id })
    getSendDetail(client, id)
      .then(result => {
        if (cancelled) return
        setState(
          result.kind === 'found'
            ? { status: 'found', id, detail: result.detail }
            : { status: 'not-found', id },
        )
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          status: isUnauthorizedError(error) ? 'unauthorized' : 'error',
          id,
        })
      })
    return () => {
      cancelled = true
    }
  }, [id, client, attempt])

  // Resposta de um envio aberto antes (troca rápida de linha) não aparece.
  const shown = state && state.id === displayId ? state : null
  const detail = shown?.status === 'found' ? shown.detail : null

  return (
    <Sheet
      open={id !== null}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t('detail.title')}</SheetTitle>
          {detail && (
            <SheetDescription className="flex flex-wrap items-center gap-2">
              <SendStatusBadge status={detail.status} />
              <span className="tabular-nums">
                {formatPortalDate(detail.createdAt, locale)}
              </span>
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          {!shown || shown.status === 'loading' ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t('detail.loading')}
            </p>
          ) : shown.status === 'not-found' ? (
            <div role="alert">
              <p className="font-medium text-foreground">
                {t('detail.notFound')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('detail.notFoundDescription')}
              </p>
            </div>
          ) : shown.status === 'unauthorized' ? (
            <p role="alert" className="text-sm text-muted-foreground">
              {t('states.sessionExpired')}
            </p>
          ) : shown.status === 'error' ? (
            <div role="alert">
              <p className="text-sm text-muted-foreground">
                {t('detail.error')}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setAttempt(n => n + 1)}
              >
                {t('detail.retry')}
              </Button>
            </div>
          ) : (
            detail && (
              <DetailBody
                detail={detail}
                locale={locale}
                portalHost={portalHost}
              />
            )
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DetailBody({
  detail,
  locale,
  portalHost,
}: {
  detail: SendDetail
  locale: string
  portalHost: string | null
}) {
  const { t } = useTranslation('thinkzap/envios')
  const failureReason = detail.failure?.reason ?? detail.failureReason
  const crmHref = detail.crmRecord
    ? crmRecordHref(portalHost, detail.crmRecord.url)
    : null

  const rows: [string, ReactNode][] = [
    [t('detail.destination'), detail.destination],
    [t('detail.line'), detail.line.name],
    [t('detail.sender'), <SenderLabel key="s" sender={detail.sender} />],
    [
      t('detail.origin'),
      t(`origin.${detail.origin}`, { defaultValue: detail.origin }),
    ],
    [t('detail.kind'), t(`kind.${detail.kind}`, { defaultValue: detail.kind })],
  ]

  return (
    <>
      {detail.hasUnconfirmed && <UnconfirmedWarning />}

      {failureReason && (
        <section className="rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/40">
          <h3 className="text-xs font-medium uppercase tracking-wide text-red-800 dark:text-red-300">
            {t('detail.failureReason')}
          </h3>
          <p className="mt-1 text-sm break-words text-red-800 dark:text-red-300">
            {capitalizeFirst(failureReason)}
          </p>
          {detail.failure?.code && (
            <p className="mt-1 text-xs text-red-700 dark:text-red-400">
              {t('detail.metaCode')}:{' '}
              <span className="font-mono">{detail.failure.code}</span>
            </p>
          )}
        </section>
      )}

      <section className="rounded-md border border-border bg-muted/30 px-3 py-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('detail.message')}
        </h3>
        {detail.template && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t('detail.template')}: {detail.template.name}
            {detail.template.language
              ? ` · ${t('detail.templateLanguage')}: ${detail.template.language}`
              : ''}
          </p>
        )}
        <p className="mt-1 text-sm whitespace-pre-wrap break-words text-foreground">
          {detail.text || t('detail.noText')}
        </p>
      </section>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('detail.timestamps')}
        </h3>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t('detail.createdAt')}</dt>
          <dd className="tabular-nums text-foreground">
            {formatPortalDate(detail.createdAt, locale)}
          </dd>
          {presentTimestamps(detail.timestamps).map(({ key, at }) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{t(`detail.${key}`)}</dt>
              <dd className="tabular-nums text-foreground">
                {formatPortalDate(at, locale)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {detail.parts.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('detail.parts')}
          </h3>
          <ul className="divide-y divide-border rounded-md border border-border">
            {detail.parts.map((part, index) => (
              <li key={index} className="px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-words text-foreground">
                    {t(`kind.${part.kind}`, { defaultValue: part.kind })}
                    {part.fileName ? ` · ${part.fileName}` : ''}
                  </span>
                  <SendStatusBadge status={part.status} />
                </div>
                {part.failureReason && (
                  <p className="mt-1 text-xs break-words text-red-700 dark:text-red-400">
                    {capitalizeFirst(part.failureReason)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail.crmRecord && (
        <section>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('detail.crmRecord')}
          </h3>
          {crmHref ? (
            <a
              href={crmHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('detail.openCrm')}
              <ExternalLinkIcon className="size-3.5" aria-hidden />
              <span className="sr-only">{t('detail.opensInNewTab')}</span>
            </a>
          ) : (
            <p className="text-sm text-foreground">
              {t(`entity.${crmEntityKey(detail.crmRecord.entity)}`)} #
              {detail.crmRecord.entityId}
            </p>
          )}
        </section>
      )}
    </>
  )
}
