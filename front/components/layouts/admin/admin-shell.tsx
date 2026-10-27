'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePortalSession } from '@/providers/portal-session-provider'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin', labelKey: 'navHome' as const, exact: true },
  { href: '/admin/clientes', labelKey: 'navClients' as const, exact: false },
  { href: '/admin/usuarios', labelKey: 'navUsers' as const, exact: false },
  {
    href: '/admin/usuarios-mcp',
    labelKey: 'navMcpUsers' as const,
    exact: false,
  },
  { href: '/admin/jobs', labelKey: 'navJobs' as const, exact: false },
  {
    href: '/admin/falhas-envio',
    labelKey: 'navOutboxFailures' as const,
    exact: false,
  },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { session, logout } = usePortalSession()
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useTranslation('admin/home')

  function handleLogout() {
    logout()
    router.replace('/admin/login')
  }

  function isNavActive(href: string, exact: boolean) {
    if (exact) {
      return pathname === href
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                H
              </div>
              <span className="font-semibold text-foreground">
                {t('brand')}
              </span>
            </div>

            <nav
              className="hidden items-center gap-1 sm:flex"
              aria-label="Admin"
            >
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors',
                    isNavActive(item.href, item.exact)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {t(item.labelKey)}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {session.name}
              </span>
            ) : null}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="size-4" />
              {t('logout')}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
