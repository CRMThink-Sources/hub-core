import type { Metadata } from 'next'
import { AdminGuestGuard } from '@/components/layouts/admin/admin-guest-guard'
import { AdminLoginForm } from '@/components/layouts/admin/admin-login-form'

export const metadata: Metadata = {
  title: 'Login — Portal Hubthink',
}

export default function AdminLoginPage() {
  return (
    <AdminGuestGuard>
      <div className="admin-login-bg flex min-h-dvh items-center justify-center p-4">
        <div className="admin-card w-full max-w-md p-8">
          <AdminLoginForm />
        </div>
      </div>
    </AdminGuestGuard>
  )
}
