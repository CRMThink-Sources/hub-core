import type { Metadata } from 'next'
import { AdminAuthGuard } from '@/components/layouts/admin/admin-auth-guard'
import { AdminAppSettingsPage } from '@/components/layouts/admin/admin-app-settings-page'
import { AdminShell } from '@/components/layouts/admin/admin-shell'

export const metadata: Metadata = {
  title: 'Configurações — Portal Hubthink',
}

type Props = {
  params: Promise<{ id: string; appId: string }>
}

export default async function AdminAppSettingsRoutePage({ params }: Props) {
  const { id, appId } = await params

  return (
    <AdminAuthGuard>
      <AdminShell>
        <AdminAppSettingsPage domainId={id} appId={appId} />
      </AdminShell>
    </AdminAuthGuard>
  )
}
