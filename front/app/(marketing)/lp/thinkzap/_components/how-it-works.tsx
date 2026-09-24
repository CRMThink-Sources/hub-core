import { SectionHeading } from './features'
import type { ThinkzapCtas } from './resolve-ctas'
import { allTutorialHashes } from './tutorial-hash'
import { TUTORIALS_SECTION_ID, TutorialTabs } from './tutorial-tabs'

/**
 * Seção "Tutoriais". Além do próprio id, carrega alvos invisíveis para
 * `#como-funciona` (link antigo da LP) e para cada `#tutorial-<slug>`: sem JS a
 * aba é só uma âncora e precisa de onde cair; com JS o `TutorialTabs` lê o hash
 * e seleciona a aba.
 */
export function HowItWorks(ctas: ThinkzapCtas) {
  const anchors = [
    'como-funciona',
    ...allTutorialHashes().map(hash => hash.slice(1)),
  ]

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
        <SectionHeading
          title="Tutoriais"
          subtitle="Simulações do caminho real, dentro do Bitrix24. Escolha um tema e clique no destaque laranja para avançar."
        />
        <div className="mt-10">
          <TutorialTabs ctas={ctas} />
        </div>
      </div>
    </section>
  )
}
