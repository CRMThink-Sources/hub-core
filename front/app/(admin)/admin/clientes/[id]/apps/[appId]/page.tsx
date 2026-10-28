import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AdminAuthGuard } from '@/components/layouts/admin/admin-auth-guard'
import { AdminAppDetailPage } from '@/components/layouts/admin/admin-app-detail-page'
import { AdminShell } from '@/components/layouts/admin/admin-shell'

export const metadata: Metadata = {
  title: 'Aplicação — Portal Hubthink',
}

type Props = {
  params: Promise<{ id: string; appId: string }>
}

export default async function AdminAppDetailRoutePage({ params }: Props) {
  const { id, appId } = await params

  return (
    <AdminAuthGuard>
      <AdminShell>
        {/* A aba ativa vem de `?aba=` (`useSearchParams`), que pede um Suspense. */}
        <Suspense>
          <AdminAppDetailPage domainId={id} appId={appId} />
        </Suspense>
      </AdminShell>
    </AdminAuthGuard>
  )
}
