import Image from 'next/image'
import {
  ArrowDown,
  ArrowRight,
  CircleCheck,
  Clock,
  FileText,
  Paperclip,
} from 'lucide-react'
import { CtaButtons } from '../../_shared/cta-buttons'
import { LpHeader as LpHeaderBase } from '../../_shared/lp-header'
import type { LpCtas } from '../../_shared/resolve-ctas'
import { LP_BASE_PATH, LP_LOCALES, type LpContent } from './content'

export function LpHeader({
  marketUrl,
  content,
}: Pick<LpCtas, 'marketUrl'> & { content: LpContent }) {
  return (
    <LpHeaderBase
      logo={
        <Image
          src="/images/clicksign/logo.png"
          alt="Clicksign"
          width={130}
          height={60}
          priority
          className="h-9 w-auto"
        />
      }
      basePath={LP_BASE_PATH}
      locales={LP_LOCALES}
      marketUrl={marketUrl}
      content={content}
    />
  )
}

export function Hero({ content, ...ctas }: LpCtas & { content: LpContent }) {
  const hero = content.hero
  return (
    <section className="relative overflow-hidden bg-linear-to-br from-primary/15 via-primary/5 to-transparent">
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
        <SignPreview copy={content.signPreview} />
      </div>
    </section>
  )
}

function SignPreview({ copy }: { copy: LpContent['signPreview'] }) {
  return (
    <div
      aria-hidden
      className="mx-auto flex w-full max-w-md flex-col items-center gap-3 lg:max-w-lg lg:flex-row"
    >
      <div className="w-full rounded-xl border border-border bg-card p-4 text-xs shadow-xl">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <FileText className="size-4 shrink-0 text-primary" />
          <span className="truncate">{copy.document}</span>
        </p>
        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-full rounded bg-muted" />
          <div className="h-1.5 w-5/6 rounded bg-muted" />
          <div className="h-1.5 w-4/6 rounded bg-muted" />
          <div className="h-1.5 w-full rounded bg-muted" />
        </div>
        <div className="mt-4 flex gap-3">
          <span className="h-6 flex-1 border-b border-dashed border-primary/60" />
          <span className="h-6 flex-1 border-b border-dashed border-primary/60" />
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground">
          {copy.sentFrom}
        </p>
      </div>

      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
        <ArrowDown className="size-4 lg:hidden" />
        <ArrowRight className="hidden size-4 lg:block" />
      </span>

      <div className="w-full rounded-xl border border-border bg-card p-3 shadow-xl">
        <p className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-foreground">
          <span className="truncate">Bitrix24 · {copy.deal}</span>
        </p>
        <ul className="space-y-1.5">
          {copy.signers.map(signer => (
            <li
              key={signer.name}
              className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs"
            >
              {signer.signed ? (
                <CircleCheck className="size-3.5 shrink-0 text-primary" />
              ) : (
                <Clock className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">{signer.name}</span>
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${signer.signed ? 'bg-accent text-primary' : 'bg-background text-muted-foreground'}`}
              >
                {signer.signed ? copy.signed : copy.waiting}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-2.5 py-1.5 text-[11px] text-primary">
          <Paperclip className="size-3.5 shrink-0" />
          {copy.signedFile}
        </p>
      </div>
    </div>
  )
}
