'use client'

import { useTranslation } from 'react-i18next'
import type { InboundFailureStatus } from '@/lib/inbound-failures'
import { AdminStatusBadge, type AdminStatusTone } from './ui/admin-status-badge'

const TONE: Record<InboundFailureStatus, AdminStatusTone> = {
  FAILED: 'danger',
  REPROCESSED: 'info',
}

/** Situação de uma falha de recebimento: sempre cor + texto, nunca só cor. */
export function InboundStatusBadge({
  status,
}: {
  status: InboundFailureStatus
}) {
  const { t } = useTranslation('admin/message-failures')

  return (
    <AdminStatusBadge tone={TONE[status]}>
      {t(`inbound.status.${status}`)}
    </AdminStatusBadge>
  )
}
