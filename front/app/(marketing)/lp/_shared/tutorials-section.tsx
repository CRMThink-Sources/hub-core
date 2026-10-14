import type { LpBaseContent } from './content'
import { SectionHeading } from './features'
import { TUTORIALS_SECTION_ID } from './tutorial-hash'

// Alvos invisíveis para cada âncora: sem JS a aba é só um link e precisa de onde cair.
export function TutorialsSection({
  copy,
  anchors,
  children,
}: {
  copy: LpBaseContent['tutorialsSection']
  /** Sem `#`. */
  anchors: string[]
  children: React.ReactNode
}) {
  return (
    <section
      id={TUTORIALS_SECTION_ID}
      className="relative scroll-mt-8 bg-muted py-16 md:py-24"
    >
      {anchors.map(id => (
        <span
          key={id}
          id={id}
          aria-hidden
          className="absolute top-0 scroll-mt-8"
        />
      ))}
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title={copy.title} subtitle={copy.subtitle} />
        <div className="mt-10">{children}</div>
      </div>
    </section>
  )
}
