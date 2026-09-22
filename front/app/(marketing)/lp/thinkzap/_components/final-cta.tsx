import { CtaButtons } from './cta-buttons'
import { FINAL_CTA } from './content'
import type { ThinkzapCtas } from './resolve-ctas'

export function FinalCta(ctas: ThinkzapCtas) {
  const hasCta = Boolean(ctas.marketUrl || ctas.whatsappLink)

  return (
    <section className="px-4 pb-16 sm:px-6 md:pb-24">
      <div className="mx-auto max-w-5xl rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {FINAL_CTA.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-primary-foreground/85">
          {hasCta ? FINAL_CTA.subtitle : FINAL_CTA.fallback}
        </p>
        <CtaButtons
          {...ctas}
          tone="onPrimary"
          className="mt-8 justify-center"
        />
      </div>
    </section>
  )
}

export function LpFooter() {
  return (
    <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
      <p>
        ThinkZap · App de WhatsApp para Bitrix24 · © {new Date().getFullYear()}
      </p>
    </footer>
  )
}
