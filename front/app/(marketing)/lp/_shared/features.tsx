import type { LucideIcon } from 'lucide-react'
import type { LpFeaturesCopy } from './content'

/** Os ícones ficam com cada LP; a copy guarda só a chave. */
export function Features<Icon extends string>({
  copy,
  icons,
}: {
  copy: LpFeaturesCopy<Icon>
  icons: Record<Icon, LucideIcon>
}) {
  return (
    <section id="funcionalidades" className="scroll-mt-8 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title={copy.title} subtitle={copy.subtitle} />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {copy.items.map(feature => {
            const Icon: LucideIcon = icons[feature.icon]
            return (
              <li
                key={feature.title}
                className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <span className="flex size-11 items-center justify-center rounded-lg bg-accent text-primary">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export function SectionHeading({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
    </div>
  )
}
