import '@/components/layouts/admin/admin-theme.css'
import { PortalSessionProvider } from '@/providers/portal-session-provider'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PortalSessionProvider>{children}</PortalSessionProvider>
}
