'use client'

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  THINKZAP_PERMISSION_CATEGORIES,
  type ThinkzapPermissionCategory,
} from '@/shared/thinkzap-permissions'

type Props = {
  activeCategory: ThinkzapPermissionCategory
  onChange: (category: ThinkzapPermissionCategory) => void
}

export function PermissionsCategoryTabs({ activeCategory, onChange }: Props) {
  const { t } = useTranslation('thinkzap/permissoes')

  return (
    <nav
      className="flex gap-1 border-b border-border"
      aria-label={t('categoryTabsAriaLabel')}
    >
      {THINKZAP_PERMISSION_CATEGORIES.map(category => {
        const isActive = activeCategory === category
        return (
          <button
            key={category}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(category)}
            className={cn(
              'relative cursor-pointer rounded-t-lg px-4 py-2 text-sm transition-colors',
              isActive
                ? 'bg-card font-semibold text-primary'
                : 'font-medium text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {t(`matrix.categoriesShort.${category}`)}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        )
      })}
    </nav>
  )
}
