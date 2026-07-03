'use client'

import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type ThinkzapPermissionAction,
  type ThinkzapPermissionCategory,
} from '@/shared/thinkzap-permissions'

const CATEGORY_CHECKED: Record<ThinkzapPermissionCategory, string> = {
  connectors: 'border-violet-500 bg-violet-500',
  finance: 'border-primary bg-primary',
}

const CATEGORY_UNCHECKED: Record<ThinkzapPermissionCategory, string> = {
  connectors: 'hover:border-violet-400 hover:bg-violet-500/10',
  finance: 'hover:border-primary/60 hover:bg-primary/10',
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

  const uncheckedHoverClass = category
    ? CATEGORY_UNCHECKED[category]
    : 'hover:border-ring hover:bg-accent'

  return (
    <label
      title={label}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-1.5',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-md border-[1.5px] text-white transition-all duration-150',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
          !disabled && 'active:scale-90',
          checked
            ? cn(checkedClass, 'shadow-sm')
            : cn(
                'border-input bg-background',
                !disabled && uncheckedHoverClass,
              ),
        )}
      >
        <CheckIcon
          className={cn(
            'h-3.5 w-3.5 transition-all duration-150',
            checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
          )}
          strokeWidth={3}
        />
      </span>
      {variant === 'defaults' && (
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
          {label}
        </span>
      )}
    </label>
  )
}
