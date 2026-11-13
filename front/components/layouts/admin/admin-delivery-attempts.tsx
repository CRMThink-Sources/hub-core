'use client'

import { useTranslation } from 'react-i18next'
import { formatPortalDate } from '@/lib/format-date'
import type { DeliveryAttempt } from '@/lib/outbox-failures'
import { AdminStatusBadge } from './ui/admin-status-badge'

/**
 * Linha do tempo das tentativas que **falharam** de um item, de envio ou de
 * recebimento. Item sem tentativas (falha anterior ao log, ou já expurgada) mostra uma
 * indicação, e não um erro.
 */
export function AdminDeliveryAttempts({
  attempts,
}: {
  attempts: DeliveryAttempt[]
}) {
  const { t, i18n } = useTranslation('admin/message-failures')

  return (
    <section aria-labelledby="delivery-attempts-title" className="space-y-2">
      <h3
        id="delivery-attempts-title"
        className="text-sm font-medium text-foreground"
      >
        {t('attempts.title')}
      </h3>

      {attempts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('attempts.empty')}</p>
      ) : (
        <ol className="space-y-2">
          {attempts.map(attempt => (
            <li
              key={attempt.id}
              className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium text-foreground">
                  {t('attempts.attemptN', { n: attempt.attempt })}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {formatPortalDate(attempt.createdAt, i18n.language)}
                </span>
                {attempt.durationMs !== null && (
                  <span className="text-muted-foreground tabular-nums">
                    {t('attempts.duration', { ms: attempt.durationMs })}
                  </span>
                )}
                {attempt.indeterminate && (
                  <AdminStatusBadge tone="warning">
                    {t('attempts.indeterminate')}
                  </AdminStatusBadge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('attempts.errorCode')}:{' '}
                <span className="font-mono">{attempt.errorCode}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-foreground">
                {attempt.message}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
