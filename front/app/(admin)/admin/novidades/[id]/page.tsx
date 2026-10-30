import type { Metadata } from 'next'
import { AdminAuthGuard } from '@/components/layouts/admin/admin-auth-guard'
import { AdminProductUpdateEditPage } from '@/components/layouts/admin/admin-product-update-edit-page'
import { AdminShell } from '@/components/layouts/admin/admin-shell'

export const metadata: Metadata = {
  title: 'Novidade — Portal Hubthink',
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminProductUpdateRoutePage({ params }: Props) {
  const { id } = await params

  return (
    <AdminAuthGuard>
      <AdminShell>
        <AdminProductUpdateEditPage id={id} />
      </AdminShell>
    </AdminAuthGuard>
  )
}
