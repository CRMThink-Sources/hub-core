import type { Metadata } from 'next'
import { AdminAuthGuard } from '@/components/layouts/admin/admin-auth-guard'
import { AdminUsersPage } from '@/components/layouts/admin/admin-users-page'
import { AdminShell } from '@/components/layouts/admin/admin-shell'

export const metadata: Metadata = {
  title: 'Usuários — Portal Hubthink',
}

export default function AdminUsersRoutePage() {
  return (
    <AdminAuthGuard>
      <AdminShell>
        <AdminUsersPage />
      </AdminShell>
    </AdminAuthGuard>
  )
}
