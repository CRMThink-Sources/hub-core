'use client'

import { useTranslation } from 'react-i18next'
import type { OutboxStatus } from '@/lib/outbox-failures'
import { AdminStatusBadge, type AdminStatusTone } from './ui/admin-status-badge'

const TONE: Record<OutboxStatus, AdminStatusTone> = {
  FAILED: 'danger',
  UNKNOWN: 'warning',
  PENDING: 'info',
  SENDING: 'info',
  SENT: 'success',
}

export function OutboxStatusBadge({ status }: { status: OutboxStatus }) {
  const { t } = useTranslation('admin/outbox-failures')

  return (
    <AdminStatusBadge tone={TONE[status]}>
      {t(`status.${status}`)}
    </AdminStatusBadge>
  )
}
