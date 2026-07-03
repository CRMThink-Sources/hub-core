'use client'

import { useTranslation } from 'react-i18next'
import {
  THINKZAP_PERMISSION_ACTIONS,
  THINKZAP_PERMISSION_CATEGORIES,
  type ThinkzapPermissionAction,
  type ThinkzapPermissionCategory,
  type ThinkzapUserPermissions,
} from '@/shared/thinkzap-permissions'
import { PermissionCheckbox } from './permission-checkbox'

type Props = {
  value: ThinkzapUserPermissions
  onChange: (next: ThinkzapUserPermissions) => void
  disabled?: boolean
  variant?: 'defaults' | 'table'
}

function CategoryToggles({
  category,
  value,
  disabled,
  variant,
  onChange,
  t,
}: {
  category: ThinkzapPermissionCategory
  value: ThinkzapUserPermissions
  disabled?: boolean
  variant: 'defaults' | 'table'
  onChange: (next: ThinkzapUserPermissions) => void
  t: (key: string) => string
}) {
  function toggle(action: ThinkzapPermissionAction) {
    if (disabled) return
    onChange({
      ...value,
      [category]: {
        ...value[category],
        [action]: !value[category][action],
      },
    })
  }

  const categoryLabelClass =
    category === 'connectors' ? 'text-violet-700' : 'text-primary'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className={`w-20 shrink-0 text-xs font-semibold ${categoryLabelClass}`}
      >
        {t(`matrix.categoriesShort.${category}`)}
      </span>
      <div className="flex items-center gap-2">
        {THINKZAP_PERMISSION_ACTIONS.map(action => (
          <PermissionCheckbox
            key={action}
            checked={value[category][action]}
            disabled={disabled}
            label={t(`matrix.actionsShort.${action}`)}
            category={category}
            action={action}
            variant={variant}
            onChange={() => toggle(action)}
          />
        ))}
      </div>
    </div>
  )
}

export function PermissionsMatrix({
  value,
  onChange,
  disabled,
  variant = 'table',
}: Props) {
  const { t } = useTranslation('thinkzap/permissoes')

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 w-full justify-between">
      {THINKZAP_PERMISSION_CATEGORIES.map(category => (
        <CategoryToggles
          key={category}
          category={category}
          value={value}
          disabled={disabled}
          variant={variant}
          onChange={onChange}
          t={t}
        />
      ))}
    </div>
  )
}
