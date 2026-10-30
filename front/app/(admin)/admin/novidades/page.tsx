import type { Metadata } from 'next'
import { AdminAuthGuard } from '@/components/layouts/admin/admin-auth-guard'
import { AdminProductUpdatesPage } from '@/components/layouts/admin/admin-product-updates-page'
import { AdminShell } from '@/components/layouts/admin/admin-shell'

export const metadata: Metadata = {
  title: 'Novidades — Portal Hubthink',
}

export default function AdminProductUpdatesRoutePage() {
  return (
    <AdminAuthGuard>
      <AdminShell>
        <AdminProductUpdatesPage />
      </AdminShell>
    </AdminAuthGuard>
  )
}
