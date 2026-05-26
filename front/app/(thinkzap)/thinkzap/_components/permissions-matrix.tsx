'use client'

import { useTranslation } from 'react-i18next'
import {
  THINKZAP_PERMISSION_ACTIONS,
  THINKZAP_PERMISSION_CATEGORIES,
  type ThinkzapPermissionAction,
  type ThinkzapPermissionCategory,
  type ThinkzapUserPermissions,
} from '@/shared/thinkzap-permissions'

type Props = {
  value: ThinkzapUserPermissions
  onChange: (next: ThinkzapUserPermissions) => void
  disabled?: boolean
  /** layout inline em uma linha (ex.: defaults ao adicionar) */
  inline?: boolean
}

function PermissionToggle({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <label
      title={label}
      className={`inline-flex cursor-pointer items-center gap-0.5 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="h-3.5 w-3.5 rounded border-gray-300 text-[#5A997E] focus:ring-[#5A997E]"
      />
      <span className="text-[10px] font-medium uppercase text-slate-500">
        {label}
      </span>
    </label>
  )
}

function CategoryToggles({
  category,
  value,
  disabled,
  onChange,
  t,
}: {
  category: ThinkzapPermissionCategory
  value: ThinkzapUserPermissions
  disabled?: boolean
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

  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] font-medium text-slate-600">
        {t(`matrix.categoriesShort.${category}`)}
      </span>
      <div className="flex items-center gap-1.5">
        {THINKZAP_PERMISSION_ACTIONS.map(action => (
          <PermissionToggle
            key={action}
            checked={value[category][action]}
            disabled={disabled}
            label={t(`matrix.actionsShort.${action}`)}
            onToggle={() => toggle(action)}
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
  inline,
}: Props) {
  const { t } = useTranslation('thinkzap/permissoes')

  if (inline) {
    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {THINKZAP_PERMISSION_CATEGORIES.map(category => (
          <CategoryToggles
            key={category}
            category={category}
            value={value}
            disabled={disabled}
            onChange={onChange}
            t={t}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {THINKZAP_PERMISSION_CATEGORIES.map(category => (
        <CategoryToggles
          key={category}
          category={category}
          value={value}
          disabled={disabled}
          onChange={onChange}
          t={t}
        />
      ))}
    </div>
  )
}
