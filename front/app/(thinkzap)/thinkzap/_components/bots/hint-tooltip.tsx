'use client'

import { AlertTriangle, Info } from 'lucide-react'

// Balão próprio: o `title` nativo abre junto do cursor e saía da tela.
export function HintTooltip({
  text,
  tone = 'info',
  side = 'bottom',
  align = 'left',
}: {
  text: string
  /** `warn` é o estado que não funciona como está, não uma explicação a mais. */
  tone?: 'info' | 'warn'
  /** `top` para quem fica no fim de um painel rolável. */
  side?: 'top' | 'bottom'
  /** Lado por onde o balão cresce: `right` quando o ícone está na borda direita. */
  align?: 'left' | 'right'
}) {
  const Icon = tone === 'warn' ? AlertTriangle : Info

  return (
    <span className="group/dica relative flex">
      <button
        type="button"
        aria-label={text}
        className={`cursor-help transition-colors focus-visible:outline-none ${
          tone === 'warn'
            ? 'text-amber-600 hover:text-amber-700 focus-visible:text-amber-700'
            : 'text-muted-foreground hover:text-foreground focus-visible:text-foreground'
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </button>

      <span
        role="tooltip"
        className={`pointer-events-none absolute z-20 hidden w-56 rounded-lg border p-2 text-[11px] leading-snug font-normal normal-case shadow-md group-hover/dica:block group-focus-within/dica:block ${
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
        } ${align === 'right' ? 'right-0' : 'left-0'} ${
          tone === 'warn'
            ? 'border-amber-500/40 bg-amber-50 text-amber-800'
            : 'border-border bg-popover text-popover-foreground'
        }`}
      >
        {text}
      </span>
    </span>
  )
}
