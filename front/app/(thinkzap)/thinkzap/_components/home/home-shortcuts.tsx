import Link from 'next/link'
import { BookOpen, Cable, ClipboardList, ScrollText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Shortcut = {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

const SHORTCUTS: readonly Shortcut[] = [
  {
    href: '/thinkzap/conexoes',
    label: 'Conexões',
    description: 'Gerencie suas linhas de WhatsApp',
    icon: Cable,
  },
  {
    href: '/thinkzap/ajuda#diretrizes',
    label: 'Diretrizes de uso',
    description: 'Boas práticas e políticas do WhatsApp',
    icon: ClipboardList,
  },
  {
    href: '/thinkzap/logs',
    label: 'Logs',
    description: 'Histórico de mensagens e eventos',
    icon: ScrollText,
  },
  {
    href: '/thinkzap/ajuda',
    label: 'Ajuda',
    description: 'Documentação e suporte',
    icon: BookOpen,
  },
]

export function HomeShortcuts() {
  return (
    <div>
      <h2 className="text-sm font-medium text-muted-foreground">
        Acesso rápido
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
              <p className="text-sm font-medium">{shortcut.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {shortcut.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
