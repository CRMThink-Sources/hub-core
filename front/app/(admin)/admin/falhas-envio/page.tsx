import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AdminAuthGuard } from '@/components/layouts/admin/admin-auth-guard'
import { AdminFailuresPage } from '@/components/layouts/admin/admin-failures-page'
import { AdminShell } from '@/components/layouts/admin/admin-shell'

export const metadata: Metadata = {
  title: 'Falhas de envio e recebimento — Portal Hubthink',
}

export default function AdminOutboxFailuresRoutePage() {
  return (
    <AdminAuthGuard>
      <AdminShell>
        {/* A aba e o portal vêm de `?tab=` / `?domain=` (`useSearchParams`), que pede um Suspense. */}
        <Suspense>
          <AdminFailuresPage />
        </Suspense>
      </AdminShell>
    </AdminAuthGuard>
  )
}
