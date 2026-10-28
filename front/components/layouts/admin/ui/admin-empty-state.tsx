import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Estado vazio/erro dentro do bloco que o tem: o frame fica, uma frase e uma ação. */
export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-dashed border-border px-5 py-6',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <Icon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
        )}
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  )
}
