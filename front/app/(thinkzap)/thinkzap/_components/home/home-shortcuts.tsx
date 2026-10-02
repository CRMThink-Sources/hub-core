'use client'

import Link from 'next/link'
import { BookOpen, Cable, ClipboardList, ScrollText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type Shortcut = {
  href: string
  /** Chave em `shortcuts.<key>` de `thinkzap/home` (rótulo e descrição). */
  key: 'conexoes' | 'diretrizes' | 'logs' | 'ajuda'
  icon: LucideIcon
}

const SHORTCUTS: readonly Shortcut[] = [
  { href: '/thinkzap/conexoes', key: 'conexoes', icon: Cable },
  {
    href: '/thinkzap/ajuda#diretrizes',
    key: 'diretrizes',
    icon: ClipboardList,
  },
  { href: '/thinkzap/logs', key: 'logs', icon: ScrollText },
  { href: '/thinkzap/ajuda', key: 'ajuda', icon: BookOpen },
]

export function HomeShortcuts() {
  const { t } = useTranslation('thinkzap/home')

  return (
    <div>
      <h2 className="text-sm font-medium text-muted-foreground">
        {t('shortcuts.title')}
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SHORTCUTS.map(shortcut => (
          <Link
            key={shortcut.href}
            href={shortcut.href}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <shortcut.icon className="size-5 text-primary" />
            <div>
              <p className="text-sm font-medium">
                {t(`shortcuts.${shortcut.key}.label`)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(`shortcuts.${shortcut.key}.description`)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
