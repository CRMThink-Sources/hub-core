import type { Metadata } from 'next'
import { AdminAuthGuard } from '@/components/layouts/admin/admin-auth-guard'
import { AdminJobsPage } from '@/components/layouts/admin/admin-jobs-page'
import { AdminShell } from '@/components/layouts/admin/admin-shell'

export const metadata: Metadata = {
  title: 'Jobs — Portal Hubthink',
}

export default function AdminJobsRoutePage() {
  return (
    <AdminAuthGuard>
      <AdminShell>
        <AdminJobsPage />
      </AdminShell>
    </AdminAuthGuard>
  )
}
