import type { Metadata } from 'next'
import { AdminAuthGuard } from '@/components/layouts/admin/admin-auth-guard'
import { AdminJobDetailRoute } from '@/components/layouts/admin/admin-job-pages'
import { AdminShell } from '@/components/layouts/admin/admin-shell'

export const metadata: Metadata = {
  title: 'Jobs — Portal Hubthink',
}

export default async function AdminJobDetailRoutePage({
  params,
}: {
  params: Promise<{ job: string }>
}) {
  const { job } = await params

  return (
    <AdminAuthGuard>
      <AdminShell>
        <AdminJobDetailRoute jobId={job} />
      </AdminShell>
    </AdminAuthGuard>
  )
}
