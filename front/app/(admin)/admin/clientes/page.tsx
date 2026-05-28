import type { Metadata } from 'next'
import { AdminAuthGuard } from '@/components/layouts/admin/admin-auth-guard'
import { AdminClientsPage } from '@/components/layouts/admin/admin-clients-page'
import { AdminShell } from '@/components/layouts/admin/admin-shell'

export const metadata: Metadata = {
  title: 'Clientes — Portal Hubthink',
}

export default function AdminClientsRoutePage() {
  return (
    <AdminAuthGuard>
      <AdminShell>
        <AdminClientsPage />
      </AdminShell>
    </AdminAuthGuard>
  )
}
