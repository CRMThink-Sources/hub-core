'use client'

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { sendStatusView } from '../../_lib/send-status'

/** Selo do estado do envio: cor e texto juntos (a cor nunca é o único sinal). */
export function SendStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('thinkzap/envios')
  const view = sendStatusView(status)

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        view.badgeClassName,
      )}
    >
      {t(view.labelKey)}
    </span>
  )
}
