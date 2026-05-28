import type { Metadata } from 'next'
import { AdminAuthGuard } from '@/components/layouts/admin/admin-auth-guard'
import { AdminHomeContent } from '@/components/layouts/admin/admin-home-content'
import { AdminShell } from '@/components/layouts/admin/admin-shell'

export const metadata: Metadata = {
  title: 'Início — Portal Hubthink',
}

export default function AdminHomePage() {
  return (
    <AdminAuthGuard>
      <AdminShell>
        <AdminHomeContent />
      </AdminShell>
    </AdminAuthGuard>
  )
}
