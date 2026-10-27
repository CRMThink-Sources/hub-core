'use client'

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { OutboxStatus } from '@/lib/outbox-failures'

export function OutboxStatusBadge({ status }: { status: OutboxStatus }) {
  const { t } = useTranslation('admin/outbox-failures')
  const tone: Record<OutboxStatus, string> = {
    FAILED: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    UNKNOWN:
      'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    PENDING: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    SENDING: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    SENT: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  }

  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tone[status],
      )}
    >
      {t(`status.${status}`)}
    </span>
  )
}
