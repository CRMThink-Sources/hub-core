import type { Metadata } from 'next'
import { AdminAuthGuard } from '@/components/layouts/admin/admin-auth-guard'
import { AdminMcpUsersPage } from '@/components/layouts/admin/admin-mcp-users-page'
import { AdminShell } from '@/components/layouts/admin/admin-shell'

export const metadata: Metadata = {
  title: 'Usuários MCP — Portal Hubthink',
}

export default function AdminMcpUsersRoutePage() {
  return (
    <AdminAuthGuard>
      <AdminShell>
        <AdminMcpUsersPage />
      </AdminShell>
    </AdminAuthGuard>
  )
}
