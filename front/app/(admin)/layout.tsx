'use client'

import { useEffect } from 'react'
import '@/components/layouts/admin/admin-theme.css'
import { PortalSessionProvider } from '@/providers/portal-session-provider'

/**
 * Paleta do Think Hub (a mesma da LP) + os tokens próprios do admin. Vai também no
 * <body>, como nos outros apps, para alcançar os portais (Dialog, Sheet, Menu).
 */
const ADMIN_THEME_CLASSES = ['theme-thinkhub', 'admin-theme']

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    document.body.classList.add(...ADMIN_THEME_CLASSES)
    return () => document.body.classList.remove(...ADMIN_THEME_CLASSES)
  }, [])

  return (
    <PortalSessionProvider>
      <div className={ADMIN_THEME_CLASSES.join(' ')}>{children}</div>
    </PortalSessionProvider>
  )
}
