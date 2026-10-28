import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Indicadores em um só container dividido por linhas de 1px (sem um card por número).
 * Duas colunas no celular, quatro a partir de `lg`.
 */
export function AdminStatGroup({
  children,
  className,
  label,
}: {
  children: React.ReactNode
  className?: string
  label?: string
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        'grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-4',
        '[&>*]:border-border max-lg:[&>*:nth-child(odd)]:border-r max-lg:[&>*:nth-child(-n+2)]:border-b lg:[&>*:not(:last-child)]:border-r',
        className,
      )}
    >
      {children}
    </section>
  )
}

type AdminStatCardProps = {
  label: string
  value?: number | null
  /** Linha auxiliar abaixo do número (ex.: "ver clientes"). */
  hint?: React.ReactNode
  href?: string
  state?: 'ready' | 'loading' | 'unavailable'
  unavailableLabel?: string
  locale?: string
}

export function AdminStatCard({
  label,
  value,
  hint,
  href,
  state = 'ready',
  unavailableLabel,
  locale,
}: AdminStatCardProps) {
  const body = (
    <>
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        {label}
        {href && (
          <ArrowUpRight
            aria-hidden
            className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        )}
      </span>
      {state === 'loading' ? (
        <span aria-hidden className="mt-2 block h-8 w-16 rounded-md bg-muted" />
      ) : state === 'unavailable' || value === null || value === undefined ? (
        <span className="mt-2 flex h-8 items-center text-sm text-muted-foreground">
          {unavailableLabel ?? '—'}
        </span>
      ) : (
        <span className="mt-2 block text-[1.75rem] leading-8 font-semibold tracking-tight text-foreground tabular-nums">
          {value.toLocaleString(locale)}
        </span>
      )}
      {hint && (
        <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      )}
    </>
  )

  const cellClass = 'flex min-h-[7.25rem] flex-col justify-start px-5 py-4'

  if (href) {
    return (
      <Link
        href={href}
        aria-busy={state === 'loading'}
        className={cn(
          cellClass,
          'group transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none',
        )}
      >
        {body}
      </Link>
    )
  }

  return (
    <div aria-busy={state === 'loading'} className={cellClass}>
      {body}
    </div>
  )
}
