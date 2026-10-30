import {
  AlertTriangle,
  Building2,
  Home,
  KeyRound,
  Megaphone,
  Timer,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type AdminNavLabelKey =
  | 'navHome'
  | 'navClients'
  | 'navProductUpdates'
  | 'navUsers'
  | 'navMcpUsers'
  | 'navJobs'
  | 'navOutboxFailures'

export type AdminNavItem = {
  href: string
  labelKey: AdminNavLabelKey
  icon: LucideIcon
  /** Início só fica ativo na própria rota; os demais também nas sub-rotas. */
  exact: boolean
}

export type AdminNavGroup = {
  /** Sem rótulo no grupo geral; "Operação" para jobs e falhas. */
  labelKey: 'navGroupOperations' | null
  items: AdminNavItem[]
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    labelKey: null,
    items: [
      { href: '/admin', labelKey: 'navHome', icon: Home, exact: true },
      {
        href: '/admin/clientes',
        labelKey: 'navClients',
        icon: Building2,
        exact: false,
      },
      {
        href: '/admin/novidades',
        labelKey: 'navProductUpdates',
        icon: Megaphone,
        exact: false,
      },
      {
        href: '/admin/usuarios',
        labelKey: 'navUsers',
        icon: Users,
        exact: false,
      },
      {
        href: '/admin/usuarios-mcp',
        labelKey: 'navMcpUsers',
        icon: KeyRound,
        exact: false,
      },
    ],
  },
  {
    labelKey: 'navGroupOperations',
    items: [
      { href: '/admin/jobs', labelKey: 'navJobs', icon: Timer, exact: false },
      {
        href: '/admin/falhas-envio',
        labelKey: 'navOutboxFailures',
        icon: AlertTriangle,
        exact: false,
      },
    ],
  },
]

export function isAdminNavActive(
  pathname: string,
  item: Pick<AdminNavItem, 'href' | 'exact'>,
): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
