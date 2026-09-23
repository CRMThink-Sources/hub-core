import Image from 'next/image'
import { CheckCheck } from 'lucide-react'
import { CtaButtons } from './cta-buttons'
import { HERO } from './content'
import type { ThinkzapCtas } from './resolve-ctas'

export function LpHeader({ marketUrl }: Pick<ThinkzapCtas, 'marketUrl'>) {
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
            Funcionalidades
          </a>
          <a href="#como-funciona" className="hover:text-foreground">
            Como funciona
          </a>
          <a href="#duvidas" className="hover:text-foreground">
            Dúvidas
          </a>
        </nav>
        {marketUrl && (
          <a
            href={marketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Instalar
          </a>
        )}
      </div>
    </header>
  )
}

export function Hero(ctas: ThinkzapCtas) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {HERO.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {HERO.title}
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            {HERO.subtitle}
          </p>
          <CtaButtons {...ctas} className="mt-8" />
        </div>
        <ChatPreview />
      </div>
    </section>
  )
}

/**
 * Ilustração de uma conversa no chat da linha aberta. Decorativa — não é print
 * de produto, então fica fora da árvore de acessibilidade.
 */
function ChatPreview() {
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
          <p className="text-xs text-muted-foreground">
            WhatsApp · Linha Vendas · Negócio #1042
          </p>
        </div>
      </div>
      <div className="space-y-3 py-4 text-sm">
        <Bubble side="in">Oi! Vocês entregam para Curitiba?</Bubble>
        <Bubble side="out">
          Entregamos sim, Maria! Quer que eu envie o orçamento?
        </Bubble>
        <div className="ml-auto w-fit max-w-[85%] space-y-2">
          <Bubble side="out">Como prefere receber?</Bubble>
          <div className="flex flex-wrap justify-end gap-2">
            <span className="rounded-full border border-primary/40 bg-background px-3 py-1 text-xs font-medium text-primary">
              Por aqui
            </span>
            <span className="rounded-full border border-primary/40 bg-background px-3 py-1 text-xs font-medium text-primary">
              Por e-mail
            </span>
          </div>
        </div>
        <Bubble side="in">Por aqui mesmo 😊</Bubble>
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        Robô do Bitrix24: negócio movido para <strong>Proposta enviada</strong>
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
