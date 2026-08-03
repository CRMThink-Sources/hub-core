'use client'

/**
 * Cartão de seção da tela de configuração.
 *
 * Existe para as três abas terem a mesma moldura: título, descrição e corpo. Antes
 * cada aba montava a sua própria caixa, com espaçamento e hierarquia diferentes.
 */
export function ConfigCard({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  /** Ação no canto do cabeçalho — ex.: atualizar lista. */
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="w-full rounded-xl border border-border bg-card">
      <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="flex flex-col px-6 py-5">{children}</div>
    </section>
  )
}
