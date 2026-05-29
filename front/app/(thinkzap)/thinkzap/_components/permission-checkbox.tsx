'use client'

import { cn } from '@/lib/utils'
import {
  type ThinkzapPermissionAction,
  type ThinkzapPermissionCategory,
} from '@/shared/thinkzap-permissions'

const CATEGORY_CHECKED: Record<ThinkzapPermissionCategory, string> = {
  connectors: 'border-violet-500 bg-violet-500',
  finance: 'border-[#5A997E] bg-[#5A997E]',
}

const ACTION_CHECKED: Record<ThinkzapPermissionAction, string> = {
  read: 'border-blue-600 bg-blue-600',
  create: 'border-sky-400 bg-sky-400',
  update: 'border-violet-500 bg-violet-500',
  delete: 'border-pink-500 bg-pink-500',
}

type Props = {
  checked: boolean
  disabled?: boolean
  label: string
  category?: ThinkzapPermissionCategory
  action?: ThinkzapPermissionAction
  variant?: 'defaults' | 'table'
  onChange: () => void
}

export function PermissionCheckbox({
  checked,
  disabled,
  label,
  category,
  action,
  variant = 'table',
  onChange,
}: Props) {
  const checkedClass =
    variant === 'defaults' && action
      ? ACTION_CHECKED[action]
      : category
        ? CATEGORY_CHECKED[category]
        : 'border-blue-600 bg-blue-600'

  return (
    <label
      title={label}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-1',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded border text-[10px] font-bold text-white transition-colors',
          checked
            ? checkedClass
            : 'border-gray-300 bg-white hover:border-gray-400',
        )}
      >
        {checked ? '✓' : ''}
      </span>
      {variant === 'defaults' && (
        <span className="text-[10px] font-semibold uppercase text-slate-600">
          {label}
        </span>
      )}
    </label>
  )
}
