'use client'

import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PASSWORD_RULES,
  checkPassword,
  type PasswordChecks,
} from '@/lib/password-policy'

type Props = {
  password: string
}

// Checklist visual da política de senha forte. Namespace admin/usuarios-mcp.
export function PasswordRequirements({ password }: Props) {
  const { t } = useTranslation('admin/usuarios-mcp')
  const checks = checkPassword(password)

  return (
    <ul className="space-y-1">
      {PASSWORD_RULES.map(rule => {
        const ok = checks[rule]
        return (
          <li
            key={rule}
            className={cn(
              'flex items-center gap-2 text-xs transition-colors',
              ok
                ? 'text-green-600 dark:text-green-400'
                : 'text-muted-foreground',
            )}
          >
            {ok ? (
              <Check className="size-3.5 shrink-0" />
            ) : (
              <X className="size-3.5 shrink-0" />
            )}
            {t(`passwordRule.${rule}`)}
          </li>
        )
      })}
    </ul>
  )
}
