'use client'

import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HealthLevel } from '@/lib/insights-format'

/**
 * Peças visuais repetidas na tela do Insights. Cores semânticas (verde, âmbar,
 * vermelho) são as mesmas do `TrendBadge` da home do ThinkZap.
 */

export function Panel({
  title,
  actions,
  className,
  children,
}: {
  title?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        'min-w-0 rounded-xl border border-border bg-card p-4',
        className,
      )}
    >
      {title || actions ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {title ? (
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          ) : null}
          {actions ? (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export type PillTone = 'good' | 'warn' | 'bad' | 'mute'

const PILL_TONES: Record<PillTone, string> = {
  good: 'bg-emerald-500/10 text-emerald-700',
  warn: 'bg-amber-500/15 text-amber-700',
  bad: 'bg-red-500/10 text-red-700',
  mute: 'bg-muted text-muted-foreground',
}

export function Pill({
  tone,
  children,
}: {
  tone: PillTone
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        PILL_TONES[tone],
      )}
    >
      {children}
    </span>
  )
}

export const levelTone = (level: HealthLevel): PillTone =>
  level === 'none' ? 'mute' : level

/** Dica no `title`: o texto vem do i18n e o navegador já o trata como texto. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      tabIndex={0}
      className="inline-flex cursor-help text-muted-foreground"
    >
      <Info className="size-4" />
    </span>
  )
}

export function Segmented<V extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: V
  options: { value: V; label: string }[]
  onChange: (value: V) => void
  label: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-lg bg-muted p-0.5"
    >
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'cursor-pointer rounded-md px-3 py-1 text-xs transition-colors',
            option.value === value
              ? 'bg-background font-semibold text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Legend({
  items,
}: {
  items: { label: string; swatch: string; line?: boolean }[]
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map(item => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <i
            className={cn(
              'inline-block rounded-sm',
              item.line ? 'h-0.5 w-4' : 'size-2.5',
              item.swatch,
            )}
          />
          {item.label}
        </span>
      ))}
    </div>
  )
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}
