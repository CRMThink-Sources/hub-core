import type { Metadata } from 'next'
import { AdminAuthGuard } from '@/components/layouts/admin/admin-auth-guard'
import { AdminProductUpdateCreatePage } from '@/components/layouts/admin/admin-product-update-create-page'
import { AdminShell } from '@/components/layouts/admin/admin-shell'

export const metadata: Metadata = {
  title: 'Nova novidade — Portal Hubthink',
}

export default function AdminProductUpdateCreateRoutePage() {
  return (
    <AdminAuthGuard>
      <AdminShell>
        <AdminProductUpdateCreatePage />
      </AdminShell>
    </AdminAuthGuard>
  )
}
