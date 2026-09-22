import { ChevronDown } from 'lucide-react'
import { FAQ } from './content'
import { SectionHeading } from './features'

/** `details`/`summary` nativos: abre e fecha sem estado React nem JS. */
export function Faq() {
  return (
    <section id="duvidas" className="scroll-mt-8 py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading title="Dúvidas frequentes" />
        <div className="mt-10 divide-y divide-border rounded-xl border border-border bg-card">
          {FAQ.map(item => (
            <details key={item.question} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown
                  aria-hidden
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
