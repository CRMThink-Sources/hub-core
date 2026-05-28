import type { Metadata } from 'next'
import { AdminAuthGuard } from '@/components/layouts/admin/admin-auth-guard'
import { AdminClientDetailPage } from '@/components/layouts/admin/admin-client-detail-page'
import { AdminShell } from '@/components/layouts/admin/admin-shell'

export const metadata: Metadata = {
  title: 'Cliente — Portal Hubthink',
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminClientDetailRoutePage({ params }: Props) {
  const { id } = await params

  return (
    <AdminAuthGuard>
      <AdminShell>
        <AdminClientDetailPage domainId={id} />
      </AdminShell>
    </AdminAuthGuard>
  )
}
