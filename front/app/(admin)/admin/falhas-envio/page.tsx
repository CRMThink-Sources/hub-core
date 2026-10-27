import type { Metadata } from 'next'
import { AdminAuthGuard } from '@/components/layouts/admin/admin-auth-guard'
import { AdminOutboxFailuresPage } from '@/components/layouts/admin/admin-outbox-failures-page'
import { AdminShell } from '@/components/layouts/admin/admin-shell'

export const metadata: Metadata = {
  title: 'Falhas de envio — Portal Hubthink',
}

export default function AdminOutboxFailuresRoutePage() {
  return (
    <AdminAuthGuard>
      <AdminShell>
        <AdminOutboxFailuresPage />
      </AdminShell>
    </AdminAuthGuard>
  )
}
