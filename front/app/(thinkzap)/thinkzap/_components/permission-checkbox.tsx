'use client'

import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  checked: boolean
  disabled?: boolean
  label: string
  variant?: 'defaults' | 'table'
  onChange: () => void
}

export function PermissionCheckbox({
  checked,
  disabled,
  label,
  variant = 'table',
  onChange,
}: Props) {
  const checkedClass = 'border-primary bg-primary'
  const uncheckedHoverClass = 'hover:border-primary/60 hover:bg-primary/10'

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
