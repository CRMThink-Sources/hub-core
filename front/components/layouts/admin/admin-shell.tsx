'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { ChevronsUpDown, LogOut, Menu } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { usePortalSession } from '@/providers/portal-session-provider'
import { cn } from '@/lib/utils'
import { ADMIN_NAV_GROUPS, isAdminNavActive } from './admin-nav'

/*
 * Moldura tingida (sidebar + barra do celular, `bg-canvas`) e o conteúdo numa folha
 * branca com 1px de borda, afastada 8px das bordas da janela no desktop.
 * Sidebar 240px; a folha ocupa o resto: 100vw - 240 - 8 (direita).
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { t } = useTranslation('admin/home')

  return (
    <div className="min-h-dvh bg-canvas">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col px-3 py-4 lg:flex">
        <AdminBrand />
        <AdminNavList className="mt-6 flex-1" />
        <AdminUserMenu />
      </aside>

      <header className="sticky top-0 z-30 flex h-12 items-center gap-2 bg-canvas px-2 lg:hidden">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger
            aria-label={t('openMenu')}
            className="inline-flex size-11 items-center justify-center rounded-md text-foreground hover:bg-admin-active focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 gap-0 bg-canvas px-3 py-4">
            <SheetTitle className="sr-only">{t('menuTitle')}</SheetTitle>
            <AdminBrand />
            <AdminNavList
              className="mt-6"
              onNavigate={() => setMobileNavOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <AdminBrand compact />
        <div className="ml-auto">
          <AdminUserMenu compact />
        </div>
      </header>

      <div className="lg:pl-60">
        <main className="min-h-[calc(100dvh-3rem)] border-border bg-background lg:my-2 lg:mr-2 lg:min-h-[calc(100dvh-1rem)] lg:rounded-2xl lg:border">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

function AdminBrand({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation('admin/home')

  return (
    <Link
      href="/admin"
      className={cn(
        'flex items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
        !compact && 'px-2 py-1',
      )}
    >
      {/* Ícone do app (app/icon.png): o mesmo do favicon, servido em /icon.png. */}
      <img src="/icon.png" alt="" className="size-7 rounded-md" />
      <span className="text-sm font-semibold text-foreground">
        {t('brand')}
      </span>
    </Link>
  )
}

function AdminNavList({
  className,
  onNavigate,
}: {
  className?: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const { t } = useTranslation('admin/home')

  return (
    <nav
      aria-label={t('navLabel')}
      className={cn('flex flex-col gap-6', className)}
    >
      {ADMIN_NAV_GROUPS.map(group => (
        <div key={group.labelKey ?? 'main'}>
          {group.labelKey && (
            <p className="mb-1 px-2.5 text-xs text-muted-foreground">
              {t(group.labelKey)}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {group.items.map(item => {
              const active = isAdminNavActive(pathname, item)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors max-lg:h-11',
                      'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                      active
                        ? 'bg-admin-active font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-admin-active/60 hover:text-foreground',
                    )}
                  >
                    <Icon
                      aria-hidden
                      strokeWidth={1.75}
                      className={cn(
                        'size-4',
                        active ? 'text-primary' : 'text-muted-foreground',
                      )}
                    />
                    {t(item.labelKey)}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function AdminUserMenu({ compact = false }: { compact?: boolean }) {
  const { session, logout } = usePortalSession()
  const router = useRouter()
  const { t } = useTranslation('admin/home')

  function handleLogout() {
    logout()
    router.replace('/admin/login')
  }

  const name = session?.name ?? ''
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('userMenu')}
        className={cn(
          'flex items-center gap-2.5 rounded-md text-left hover:bg-admin-active/60 focus-visible:ring-2 focus-visible:ring-ring/50',
          compact ? 'size-11 justify-center' : 'w-full px-2 py-2',
        )}
      >
        <span
          aria-hidden
          className="flex size-7 flex-none items-center justify-center rounded-full bg-status-info-soft text-xs font-medium text-status-info-ink"
        >
          {initials || '·'}
        </span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">
                {name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {session?.email}
              </span>
            </span>
            <ChevronsUpDown
              aria-hidden
              className="size-4 flex-none text-muted-foreground"
            />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? 'end' : 'start'} className="w-52">
        {compact && (
          <div className="px-2 py-1.5">
            <p className="truncate text-sm text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {session?.email}
            </p>
          </div>
        )}
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="size-4" />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
