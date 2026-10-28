import { cn } from '@/lib/utils'

export type AdminStatusTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'

const PILL_TONE: Record<AdminStatusTone, string> = {
  success: 'bg-status-success-soft text-status-success-ink',
  warning: 'bg-status-warning-soft text-status-warning-ink',
  danger: 'bg-status-danger-soft text-status-danger-ink',
  info: 'bg-status-info-soft text-status-info-ink',
  neutral: 'bg-status-neutral-soft text-status-neutral-ink',
}

const DOT_TONE: Record<AdminStatusTone, string> = {
  success: 'bg-status-success',
  warning: 'bg-status-warning',
  danger: 'bg-status-danger',
  info: 'bg-status-info',
  neutral: 'bg-status-neutral',
}

/**
 * Status do portal admin: sempre cor + texto (nunca só cor). `pill` para células de
 * tabela; `dot` para listas onde o rótulo fica em tinta normal ao lado do ponto.
 */
export function AdminStatusBadge({
  tone,
  children,
  variant = 'pill',
  pulse = false,
  className,
}: {
  tone: AdminStatusTone
  children: React.ReactNode
  variant?: 'pill' | 'dot'
  /** Ponto pulsando: só para o que está em andamento agora. */
  pulse?: boolean
  className?: string
}) {
  if (variant === 'dot') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-2 text-sm whitespace-nowrap text-foreground',
          className,
        )}
      >
        <span
          aria-hidden
          className={cn(
            'size-2 flex-none rounded-full',
            DOT_TONE[tone],
            pulse && 'motion-safe:animate-pulse',
          )}
        />
        {children}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex h-6 flex-none items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap',
        PILL_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
