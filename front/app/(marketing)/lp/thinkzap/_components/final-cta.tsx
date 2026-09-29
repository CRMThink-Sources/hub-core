import type { LpContent } from './content'
import { CtaButtons } from './cta-buttons'
import type { ThinkzapCtas } from './resolve-ctas'

export function FinalCta({
  content,
  ...ctas
}: ThinkzapCtas & { content: LpContent }) {
  const copy = content.finalCta
  const hasCta = Boolean(ctas.marketUrl || ctas.whatsappLink)

  return (
    <section className="px-4 pb-16 sm:px-6 md:pb-24">
      <div className="mx-auto max-w-5xl rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {copy.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-primary-foreground/85">
          {hasCta ? copy.subtitle : copy.fallback}
        </p>
        <CtaButtons
          {...ctas}
          labels={content.ctaButtons}
          tone="onPrimary"
          className="mt-8 justify-center"
        />
      </div>
    </section>
  )
}

export function LpFooter({ content }: { content: LpContent }) {
  return (
    <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
      <p>{content.footer(new Date().getFullYear())}</p>
    </footer>
  )
}
