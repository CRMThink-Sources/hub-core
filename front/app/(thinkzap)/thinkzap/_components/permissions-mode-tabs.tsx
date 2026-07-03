'use client'

import { Building2, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export type PermissionsTabMode = 'users' | 'departments'

type Props = {
  activeTab: PermissionsTabMode
  onChange: (tab: PermissionsTabMode) => void
}

export function PermissionsModeTabs({ activeTab, onChange }: Props) {
  const { t } = useTranslation('thinkzap/permissoes')

  const tabs: {
    id: PermissionsTabMode
    icon: typeof Users
    titleKey: string
    descriptionKey: string
    activeBorder: string
    iconBg: string
    iconColor: string
  }[] = [
    {
      id: 'users',
      icon: Users,
      titleKey: 'tabs.byUser',
      descriptionKey: 'tabs.byUserDescription',
      activeBorder: 'border-t-primary ring-1 ring-primary/20',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      id: 'departments',
      icon: Building2,
      titleKey: 'tabs.byDepartment',
      descriptionKey: 'tabs.byDepartmentDescription',
      activeBorder: 'border-t-primary ring-1 ring-primary/20',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm',
              'border-t-4',
              isActive
                ? tab.activeBorder
                : 'border-t-transparent opacity-80 hover:opacity-100',
            )}
          >
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                tab.iconBg,
              )}
            >
              <Icon className={cn('h-5 w-5', tab.iconColor)} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t(tab.titleKey)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(tab.descriptionKey)}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
