import { cn } from '@/lib/utils'

/**
 * Bloco do admin: borda de 1px, sem sombra (a folha já separa da moldura). O
 * cabeçalho é opcional; `action` fica à direita do título (ex.: "Ver todos").
 */
export function AdminPanel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-lg border border-border bg-card',
        className,
      )}
    >
      {(title || action) && (
        <header className="flex min-h-12 items-center justify-between gap-4 px-5 pt-3">
          {title && (
            <h2 className="text-sm font-medium text-foreground">{title}</h2>
          )}
          {action}
        </header>
      )}
      <div
        className={cn(
          'flex-1 px-5 pb-5',
          !title && !action && 'pt-5',
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  )
}
