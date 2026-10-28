import type { Metadata } from 'next'
import { AdminAuthGuard } from '@/components/layouts/admin/admin-auth-guard'
import { AdminJobsCatalogPage } from '@/components/layouts/admin/admin-jobs-catalog-page'
import { AdminShell } from '@/components/layouts/admin/admin-shell'

export const metadata: Metadata = {
  title: 'Jobs — Portal Hubthink',
}

export default function AdminJobsRoutePage() {
  return (
    <AdminAuthGuard>
      <AdminShell>
        <AdminJobsCatalogPage />
      </AdminShell>
    </AdminAuthGuard>
  )
}
