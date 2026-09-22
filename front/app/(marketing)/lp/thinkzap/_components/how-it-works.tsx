import { SectionHeading } from './features'
import { InstallWalkthrough } from './install-walkthrough'
import type { ThinkzapCtas } from './resolve-ctas'

export function HowItWorks(ctas: ThinkzapCtas) {
  return (
    <section id="como-funciona" className="scroll-mt-8 bg-muted py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          title="Veja como é instalar e configurar"
          subtitle="Uma simulação do caminho real, do Market ao primeiro atendimento. Clique no botão destacado para avançar."
        />
        <div className="mt-12">
          <InstallWalkthrough {...ctas} />
        </div>
      </div>
    </section>
  )
}
