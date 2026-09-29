import Image from 'next/image'
import { CheckCheck } from 'lucide-react'
import type { LpContent } from './content'
import { CtaButtons } from './cta-buttons'
import { LanguageSwitch } from './language-switch'
import type { ThinkzapCtas } from './resolve-ctas'

export function LpHeader({
  marketUrl,
  content,
}: Pick<ThinkzapCtas, 'marketUrl'> & { content: LpContent }) {
  const { nav } = content
  return (
    <header className="border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Image
          src="/images/thinkzap/logo.png"
          alt="ThinkZap"
          width={130}
          height={60}
          priority
          className="h-9 w-auto"
        />
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a href="#funcionalidades" className="hover:text-foreground">
            {nav.features}
          </a>
          <a href="#tutoriais" className="hover:text-foreground">
            {nav.tutorials}
          </a>
          <a href="#duvidas" className="hover:text-foreground">
            {nav.faq}
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitch
            locale={content.locale}
            label={content.languageSwitch.label}
          />
          {marketUrl && (
            <a
              href={marketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {nav.install}
            </a>
          )}
        </div>
      </div>
    </header>
  )
}

export function Hero({
  content,
  ...ctas
}: ThinkzapCtas & { content: LpContent }) {
  const hero = content.hero
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {hero.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {hero.title}
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            {hero.subtitle}
          </p>
          <CtaButtons {...ctas} labels={content.ctaButtons} className="mt-8" />
        </div>
        <ChatPreview copy={content.chatPreview} />
      </div>
    </section>
  )
}

/**
 * Ilustração de uma conversa no chat da linha aberta. Decorativa — não é print
 * de produto, então fica fora da árvore de acessibilidade.
 */
function ChatPreview({ copy }: { copy: LpContent['chatPreview'] }) {
  const { messages, robot } = copy
  return (
    <div
      aria-hidden
      className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-xl"
    >
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
          MC
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Maria Clara</p>
          <p className="text-xs text-muted-foreground">{copy.contactDetail}</p>
        </div>
      </div>
      <div className="space-y-3 py-4 text-sm">
        <Bubble side="in">{messages.question}</Bubble>
        <Bubble side="out">{messages.answer}</Bubble>
        <div className="ml-auto w-fit max-w-[85%] space-y-2">
          <Bubble side="out">{messages.ask}</Bubble>
          <div className="flex flex-wrap justify-end gap-2">
            {messages.options.map(option => (
              <span
                key={option}
                className="rounded-full border border-primary/40 bg-background px-3 py-1 text-xs font-medium text-primary"
              >
                {option}
              </span>
            ))}
          </div>
        </div>
        <Bubble side="in">{messages.reply}</Bubble>
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        {robot.before} <strong>{robot.stage}</strong>
      </p>
    </div>
  )
}

function Bubble({
  side,
  children,
}: {
  side: 'in' | 'out'
  children: React.ReactNode
}) {
  return side === 'in' ? (
    <p className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
      {children}
    </p>
  ) : (
    <p className="ml-auto flex w-fit max-w-[85%] items-end gap-1 rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-primary-foreground">
      <span>{children}</span>
      <CheckCheck className="size-3.5 shrink-0 opacity-80" />
    </p>
  )
}
